import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  type: 'file' | 'dir';
  group: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
}

interface VisualizerProps {
  files: { path: string, type: 'file' | 'dir' }[];
  onFileClick?: (path: string) => void;
  selectedFileId?: string | null;
  filterQuery?: string;
  activeSearchMatchId?: string;
}

export const RepoVisualizer: React.FC<VisualizerProps> = ({ files, onFileClick, selectedFileId, filterQuery, activeSearchMatchId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<any[]>([]);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

  const filterPropsRef = useRef({ filterQuery, selectedFileId, activeSearchMatchId });
  filterPropsRef.current = { filterQuery, selectedFileId, activeSearchMatchId };

  useEffect(() => {
    if (!svgRef.current || files.length === 0) return;

    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', [0, 0, width, height]);

    svg.selectAll('*').remove();

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    const gLinks = g.append('g')
      .attr('stroke', 'rgba(56, 189, 248, 0.25)')
      .attr('stroke-width', 0.5);

    const gNodes = g.append('g');

    // Process files into nodes and links
    const allNodesMap = new Map<string, Node>();
    const allLinks: Link[] = [];

    files.forEach((file) => {
      const parts = file.path.split('/');
      let currentPath = '';

      parts.forEach((part, index) => {
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        const isDir = index < parts.length - 1 || file.type === 'dir';

        if (!allNodesMap.has(currentPath)) {
          const node: Node = {
            id: currentPath,
            type: isDir ? 'dir' : 'file',
            group: index,
          };
          allNodesMap.set(currentPath, node);

          if (parentPath) {
            allLinks.push({
              source: parentPath,
              target: currentPath,
            });
          }
        }
      });
    });

    zoomRef.current = zoom as d3.ZoomBehavior<SVGSVGElement, unknown>;
    svgSelectionRef.current = svg as d3.Selection<SVGSVGElement, unknown, null, undefined>;

    const simulation = d3.forceSimulation<Node>()
      .force('link', d3.forceLink<Node, Link>().id(d => d.id).distance(40))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const collapsedDirs = new Set<string>();
    let linkGroup: any;
    let nodeGroup: any;

    const applyStyles = (query: string, sfId: string | null | undefined) => {
        svg.selectAll('.node')
           .attr('opacity', (d: any) => {
              if (sfId) return d.id === sfId ? 1 : 0.1;
              if (!query) return 1;
              return d.id.toLowerCase().includes(query) ? 1 : 0.1;
           });
        svg.selectAll('.link')
           .attr('opacity', (d: any) => {
              if (sfId) return 0.1;
              if (!query) return 1;
              const sourceMatch = (typeof d.source === 'string' ? d.source : d.source.id).toLowerCase().includes(query);
              const targetMatch = (typeof d.target === 'string' ? d.target : d.target.id).toLowerCase().includes(query);
              return (sourceMatch || targetMatch) ? 0.3 : 0.05;
           });
    };

    function updateGraph() {
      const visibleNodesMap = new Map<string, Node>();
      const visibleLinks: Link[] = [];

      allNodesMap.forEach((node, path) => {
         const parts = path.split('/');
         let isVisible = true;
         let checkPath = '';
         for (let i = 0; i < parts.length - 1; i++) {
            checkPath = checkPath ? `${checkPath}/${parts[i]}` : parts[i];
            if (collapsedDirs.has(checkPath)) {
               isVisible = false;
               break;
            }
         }
         
         if (isVisible) {
            visibleNodesMap.set(path, node);
         }
      });

      allLinks.forEach(link => {
         const sourceId = typeof link.source === 'string' ? link.source : (link.source as Node).id;
         const targetId = typeof link.target === 'string' ? link.target : (link.target as Node).id;
         
         if (visibleNodesMap.has(sourceId) && visibleNodesMap.has(targetId)) {
            visibleLinks.push(Object.assign({}, link));
         }
      });

      const visibleNodes = Array.from(visibleNodesMap.values());
      nodesRef.current = visibleNodes;

      linkGroup = gLinks.selectAll('line')
        .data(visibleLinks, (d: any) => (typeof d.source === 'string' ? d.source : d.source.id) + '-' + (typeof d.target === 'string' ? d.target : d.target.id))
        .join('line')
        .attr('class', 'link');

      nodeGroup = gNodes.selectAll('g.node')
        .data(visibleNodes, (d: any) => d.id)
        .join(
          enter => {
            const nodeEnter = enter.append('g')
              .attr('class', 'node')
              .call(d3.drag<SVGGElement, Node>()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended) as any)
              .on('mouseover', (event, d) => {
                setHoveredNode(d.id);
                d3.select(event.currentTarget).select('text.label').attr('opacity', 1);
                d3.select(event.currentTarget).select('text.indicator').attr('opacity', 1);
                if (tooltipRef.current) {
                   tooltipRef.current.style.left = `${event.pageX + 10}px`;
                   tooltipRef.current.style.top = `${event.pageY + 10}px`;
                }
              })
              .on('mousemove', (event) => {
                if (tooltipRef.current) {
                   tooltipRef.current.style.left = `${event.pageX + 10}px`;
                   tooltipRef.current.style.top = `${event.pageY + 10}px`;
                }
              })
              .on('mouseout', (event, d) => {
                setHoveredNode(null);
                d3.select(event.currentTarget).select('text.label').attr('opacity', d.type === 'dir' ? 1 : 0);
                d3.select(event.currentTarget).select('text.indicator').attr('opacity', d.type === 'dir' ? 1 : 0);
              })
              .on('click', (event, d) => {
                if (d.type === 'dir') {
                  if (collapsedDirs.has(d.id)) {
                    collapsedDirs.delete(d.id);
                  } else {
                    collapsedDirs.add(d.id);
                  }
                  updateGraph();
                } else if (d.type === 'file' && onFileClick) {
                  onFileClick(d.id);
                }
              });

            nodeEnter.append('circle')
              .attr('r', d => d.type === 'dir' ? 5 : 3)
              .attr('fill', d => d.type === 'dir' ? 'transparent' : '#0ea5e9')
              .attr('stroke', d => d.type === 'dir' ? '#38bdf8' : '#0284c7')
              .attr('stroke-width', d => d.type === 'dir' ? 1 : 0)
              .style('cursor', 'pointer');

            nodeEnter.append('text')
              .attr('class', 'label')
              .text(d => d.id.split('/').pop() || d.id)
              .attr('x', 8)
              .attr('y', 3)
              .attr('font-size', '10px')
              .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace')
              .attr('fill', '#e0f2fe')
              .attr('opacity', d => d.type === 'dir' ? 1 : 0)
              .attr('pointer-events', 'none')
              .style('text-shadow', '0 0 4px rgba(2, 132, 199, 0.8), 0 0 8px rgba(0, 0, 0, 0.8)');

            nodeEnter.append('text')
              .attr('class', 'indicator')
              .attr('font-size', '8px')
              .attr('text-anchor', 'middle')
              .attr('y', 2.5)
              .attr('fill', '#38bdf8')
              .attr('pointer-events', 'none')
              .attr('opacity', d => d.type === 'dir' ? 1 : 0);

            return nodeEnter;
          },
          update => update,
          exit => exit.transition().duration(300).attr('opacity', 0).remove()
        );

      nodeGroup.select('text.indicator')
        .text((d: any) => d.type === 'dir' ? (collapsedDirs.has(d.id) ? '+' : '-') : '');

      applyStyles(filterPropsRef.current.filterQuery || '', filterPropsRef.current.selectedFileId);

      simulation.nodes(visibleNodes);
      simulation.force<d3.ForceLink<Node, Link>>('link')!.links(visibleLinks);
      simulation.alpha(0.3).restart();
    }

    updateGraph();

    simulation.on('tick', () => {
      if (linkGroup) {
        linkGroup
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);
      }
      if (nodeGroup) {
        nodeGroup.attr('transform', (d: any) => `translate(${d.x || 0},${d.y || 0})`);
      }
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    // Zoom controls logic can be bound to buttons if needed, but wheel zoom works directly.

  }, [files, onFileClick]);

  useEffect(() => {
    if (!svgSelectionRef.current || !zoomRef.current || nodesRef.current.length === 0) return;
    const svg = svgSelectionRef.current;
    const zoom = zoomRef.current;
    const query = filterQuery ? filterQuery.toLowerCase() : '';

    const focusId = selectedFileId || activeSearchMatchId;

    if (focusId) {
      const targetNode: any = nodesRef.current.find(n => n.id === focusId);
      if (targetNode && targetNode.x != null && targetNode.y != null) {
        const width = 800;
        const height = 600;
        const scale = 5;
        // Shift center to the left by 200 internal viewBox units to account for the wider right sidebar
        // Only shift if it's the selectedFileId (since that opens the sidebar)
        const xOffset = selectedFileId ? -200 : 0;
        const x = width / 2 - targetNode.x * scale + xOffset;
        const y = height / 2 - targetNode.y * scale;

        svg.transition().duration(750)
          .call(zoom.transform as any, d3.zoomIdentity.translate(x, y).scale(scale))
          .on("end", () => {
             // Maintain zoom level by disabling zoom event listeners only if selectedFileId
             if (selectedFileId) {
                svg.on(".zoom", null);
             } else {
                svg.call(zoom as any);
             }
          });

        svg.selectAll('.node')
          .transition().duration(750)
          .attr('opacity', (d: any) => {
             if (selectedFileId) {
                 return d.id === selectedFileId ? 1 : 0.1;
             }
             if (!query) return 1;
             return d.id.toLowerCase().includes(query) ? 1 : 0.1;
          });
        
        svg.selectAll('.link')
          .transition().duration(750)
          .attr('opacity', (d: any) => {
             if (selectedFileId) return 0.1;
             if (!query) return 1;
             const sourceMatch = d.source.id.toLowerCase().includes(query);
             const targetMatch = d.target.id.toLowerCase().includes(query);
             return (sourceMatch || targetMatch) ? 0.3 : 0.05;
          });
      }
    } else {
      // Re-enable zoom event listeners
      svg.call(zoom as any);

      svg.transition().duration(750).call(
        zoom.transform as any, 
        d3.zoomIdentity
      );

      svg.selectAll('.node')
        .transition().duration(750)
        .attr('opacity', (d: any) => {
          if (!query) return 1;
          return d.id.toLowerCase().includes(query) ? 1 : 0.1;
        });
        
      svg.selectAll('.link')
        .transition().duration(750)
        .attr('opacity', (d: any) => {
          if (!query) return 1;
          const sourceMatch = d.source.id.toLowerCase().includes(query);
          const targetMatch = d.target.id.toLowerCase().includes(query);
          return (sourceMatch || targetMatch) ? 0.3 : 0.05;
        });
    }
  }, [selectedFileId, activeSearchMatchId, filterQuery]);

  return (
    <div className="w-full h-full relative group">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing outline-none" />
      
      {/* HUD overlays */}
      <div className="absolute top-6 left-6 text-[10px] font-sans uppercase tracking-widest border border-white/20 bg-slate-950/60 backdrop-blur px-4 py-2.5 flex items-center gap-6 shadow-2xl shadow-sky-900/20 z-10 pointer-events-none text-white rounded-sm">
        <span className="font-semibold text-sky-400">Coordinate Map</span>
        <span className="opacity-50 text-sky-100">scroll to zoom • drag to pan</span>
      </div>

      {hoveredNode && (
        <div 
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none bg-slate-900 border border-sky-500/30 text-sky-100 px-3 py-1.5 text-xs font-mono rounded-sm shadow-xl shadow-sky-900/20 max-w-xs break-words"
        >
          {hoveredNode}
        </div>
      )}
    </div>
  );
};
