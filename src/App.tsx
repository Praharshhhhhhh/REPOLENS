import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Github, FileUp, ChevronRight, Bolt, Shield, Activity, Globe, ArrowLeft, Loader2, Search } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { analyzeCodebase } from './services/aiService';
import { FileNode, RepoAnalysis } from './types';
import { RepoVisualizer } from './components/RepoVisualizer';
import { LandingPage } from './components/LandingPage';
import { AIChat } from './components/AIChat';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const allPaths = React.useMemo(() => {
    const paths = new Set<string>();
    files.forEach(f => {
        const parts = f.path.split('/');
        let current = '';
        parts.forEach(p => {
            current = current ? current + '/' + p : p;
            paths.add(current);
        });
    });
    return Array.from(paths);
  }, [files]);

  const searchMatches = React.useMemo(() => {
    if (!filterQuery) return [];
    const lowerQ = filterQuery.toLowerCase();
    return allPaths.filter(p => p.toLowerCase().includes(lowerQ));
  }, [allPaths, filterQuery]);

  React.useEffect(() => {
    setActiveMatchIndex(0);
  }, [filterQuery]);

  const handlePrevMatch = () => {
    setActiveMatchIndex(prev => (prev > 0 ? prev - 1 : searchMatches.length - 1));
  };

  const handleNextMatch = () => {
    setActiveMatchIndex(prev => (prev < searchMatches.length - 1 ? prev + 1 : 0));
  };
  
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [fileExplanation, setFileExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleFileClick = React.useCallback(async (fileId: string) => {
    const file = files.find(f => f.path === fileId);
    if (!file) return;

    setSelectedFile(file);
    setFileExplanation(null);
    setIsExplaining(true);

    try {
      import('./services/aiService').then(async ({ analyzeFile }) => {
        try {
          const result = await analyzeFile(file.path, file.content || "Content unavailable or excluded.");
          setFileExplanation(result);
        } catch (e) {
          setFileExplanation("Failed to generate explanation for this file.");
        } finally {
          setIsExplaining(false);
        }
      });
    } catch (e) {
      setIsExplaining(false);
    }
  }, [files]);


  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    try {
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const extractedFiles: FileNode[] = [];
        
        for (const [path, zipEntry] of Object.entries(content.files)) {
          if (!zipEntry.dir) {
            // Read content of small files only to avoid memory issues
            let fileContent;
            // Ignore obvious binary extensions
            if (!path.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|mp4)$/i)) {
              fileContent = await zipEntry.async("string");
            }
            extractedFiles.push({
              path,
              type: 'file',
              content: fileContent
            });
          }
        }
        setFiles(extractedFiles);
        const result = await analyzeCodebase(extractedFiles);
        setAnalysis(result);
      } else {
        setError('Please upload a ZIP file or provide a GitHub link.');
      }
    } catch (err) {
      setError('Neural calibration failed. Please verify file integrity.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const decodeRepo = async () => {
    if (!repoUrl) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await analyzeCodebase([], repoUrl);
      setAnalysis(result);
      // Mock files for visualization since we can't crawl GitHub without token easily in client
      setFiles([
        { path: 'src/main.tsx', type: 'file' },
        { path: 'src/App.tsx', type: 'file' },
        { path: 'src/components/Header.tsx', type: 'file' },
        { path: 'package.json', type: 'file' },
        { path: 'public/index.html', type: 'file' }
      ]);
    } catch (err) {
      setError('Protocol error: Failed to fetch repository data.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/zip': ['.zip'] }
  });

  return (
    <div className="min-h-screen bg-background text-primary selection:bg-primary/20 font-serif overflow-x-hidden">
      {/* Header Navigation */}
      <nav className={`fixed left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 py-4 backdrop-blur-md bg-white/60 transition-all ${analysis ? 'top-0 w-full border-b border-black/10' : 'top-0 sm:top-4 max-w-7xl mx-auto border-b sm:border border-black/10 sm:rounded-sm'}`}>
        <div className="flex items-center gap-8">
          <span className="font-bold text-xl tracking-tighter uppercase font-sans">RepoLens</span>
          <span className="text-[11px] uppercase tracking-widest font-sans opacity-60 hidden sm:block">The Repository Intelligence Engine</span>
        </div>
        
        <div className="hidden md:flex items-center gap-10 font-sans text-[11px] uppercase tracking-widest opacity-60">
          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="hover:opacity-100 transition-opacity">Platform</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity">Documentation</a>
          <a href="mailto:support@repolens.io" className="hover:opacity-100 transition-opacity">Support</a>
        </div>

        <button 
          onClick={() => {
            setAnalysis(null);
            setFiles([]);
            const repoInput = document.querySelector('input') as HTMLInputElement;
            if (repoInput) {
              window.scrollTo({top: 0, behavior: 'smooth'});
              setTimeout(() => repoInput.focus(), 300);
            }
          }}
          className="bg-primary text-on-primary py-2.5 px-8 font-sans text-[11px] uppercase tracking-[0.2em] hover:bg-black transition-all">
          Generate Intel
        </button>
      </nav>

      <main className="pb-20">
        <AnimatePresence mode="wait">
          {!analysis && !isAnalyzing ? (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
            >
              <LandingPage
                repoUrl={repoUrl}
                setRepoUrl={setRepoUrl}
                onDecode={decodeRepo}
                getRootProps={getRootProps}
                getInputProps={getInputProps}
                isDragActive={isDragActive}
                error={error}
              />
            </motion.div>
          ) : isAnalyzing ? (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6">
              <span className="text- editorial-label animate-pulse">Mapping Neural Nodes...</span>
              <div className="h-px w-32 bg-primary/20" />
              <p className="italic font-light text-muted">Decoding the system architecture.</p>
            </div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen bg-background pt-[80px] z-40 relative pb-16"
            >
              {/* Summary Section */}
              <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-24">
                
                {/* Left/Main Column: Overview */}
                <div className="col-span-1 lg:col-span-2 space-y-12">
                  
                  {/* Header Info */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 border-b border-black/10 pb-6">
                       <button 
                        onClick={() => { setAnalysis(null); setFiles([]); }}
                        className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-all shrink-0"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <div className="min-w-0">
                        <h2 className="text-editorial-label mb-1">System Stage</h2>
                        <p className="text-2xl lg:text-3xl italic font-light truncate">{repoUrl || 'Project Archive'}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      {analysis?.techStack.map(tech => (
                        <span key={tech} className="text-[10px] uppercase tracking-widest font-sans opacity-60 px-3 py-1.5 border border-black/10 rounded-sm">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Intelligent Summary */}
                  <div className="space-y-4">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Repository Purpose</h3>
                    <div className="markdown-body prose prose-slate leading-relaxed">
                      <ReactMarkdown>{analysis?.purpose || ""}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Architecture */}
                  <div className="bg-primary text-white p-8 rounded-sm shadow-md space-y-4">
                    <h3 className="text-editorial-label opacity-50 uppercase tracking-widest text-[9px] border-b border-white/10 pb-2">Architecture Overview</h3>
                    <div className="markdown-body leading-relaxed opacity-90 prose-invert prose-slate">
                      <ReactMarkdown>{analysis?.architectureOverview || ""}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Setup Instructions */}
                  <div className="space-y-4">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Setup Instructions</h3>
                    <div className="markdown-body prose prose-slate leading-relaxed">
                      <ReactMarkdown>{analysis?.setupInstructions || ""}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Right Column: Metadata and Directories */}
                <div className="space-y-12 lg:pl-12 lg:border-l border-black/10">
                  <div className="space-y-6">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Intelligence Metadata</h3>
                    <div className="space-y-6 pt-2">
                      <div>
                        <span className="text-[10px] font-sans uppercase tracking-widest opacity-40 block mb-1">Estimated Complexity</span>
                        <span className="text-[15px] font-medium">{analysis?.estimatedComplexity}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans uppercase tracking-widest opacity-40 block mb-1">Project Status</span>
                        <span className="text-[15px] font-medium">{analysis?.projectStatus}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans uppercase tracking-widest opacity-40 block mb-1">Protocol Entry</span>
                        <span className="text-[15px] italic font-light break-words">{analysis?.entryPoint}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-sans uppercase tracking-widest opacity-40 block mb-1">Active Threads</span>
                        <span className="text-[15px] italic font-light">{files.length} Nodes</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Important Folders</h3>
                    <div className="space-y-6 pt-2">
                      {analysis?.importantFolders?.map(folder => (
                        <div key={folder.name} className="group">
                          <h4 className="text-[13px] font-medium font-sans mb-1 group-hover:text-primary transition-colors cursor-pointer break-all">{folder.name}</h4>
                          <p className="text-[12px] font-sans leading-relaxed text-black/50 uppercase tracking-wider mt-2">{folder.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Panel: Coordinate Map */}
              <div ref={mapContainerRef} className="w-full relative bg-[#020617] mt-12 border-y border-black/10 shadow-inner overflow-hidden" style={{ height: '85vh', backgroundImage: 'radial-gradient(circle at center, rgba(14, 165, 233, 0.05) 0%, transparent 70%)' }}>
                {/* Node Filter input */}
                <div className="absolute top-6 right-6 z-10 w-80 pointer-events-auto">
                  <div className="relative flex items-center bg-slate-900/80 backdrop-blur border border-sky-500/30 rounded-sm shadow-xl shadow-sky-900/20 overflow-hidden text-sky-100 pr-2">
                    <div className="pl-3 py-2 text-sky-400">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Filter nodes..."
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      className="flex-1 bg-transparent border-none py-2 px-3 text-[12px] font-mono outline-none placeholder:text-sky-700 focus:ring-0 min-w-0"
                    />
                    {filterQuery && searchMatches.length > 0 && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-sky-600/80">
                          {activeMatchIndex + 1}/{searchMatches.length}
                        </span>
                        <div className="flex flex-col ml-1">
                          <button onClick={handlePrevMatch} className="text-sky-500 hover:text-sky-300 transition-colors p-[1px]">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                          </button>
                          <button onClick={handleNextMatch} className="text-sky-500 hover:text-sky-300 transition-colors p-[1px]">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </button>
                        </div>
                      </div>
                    )}
                    {filterQuery && searchMatches.length === 0 && (
                       <span className="text-[10px] font-mono text-pink-500/80 shrink-0">0/0</span>
                    )}
                  </div>
                </div>

                <RepoVisualizer 
                  files={files} 
                  onFileClick={handleFileClick} 
                  selectedFileId={selectedFile?.path} 
                  filterQuery={filterQuery} 
                  activeSearchMatchId={searchMatches.length > 0 ? searchMatches[activeMatchIndex] : undefined}
                />
                
                <AnimatePresence>
              {selectedFile && (
                <motion.div 
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  transition={{ ease: "easeOut", duration: 0.3 }}
                  className="absolute top-0 right-0 h-full w-[35rem] max-w-full bg-white border-l border-black/10 shadow-2xl z-20 flex flex-col"
                >
                  <div className="flex justify-between items-start border-b border-black/10 p-5 bg-slate-50/80 backdrop-blur">
                    <div className="min-w-0 pr-4">
                      <span className="text-editorial-label opacity-40 block mb-2">Focus Node</span>
                      <h3 className="text-[15px] font-mono break-words font-semibold leading-tight">{selectedFile.path}</h3>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="h-10 w-10 rounded flex items-center justify-center hover:bg-black/10 flex-shrink-0 transition-colors">✕</button>
                  </div>
                  
                  <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
                    {isExplaining ? (
                      <div className="flex flex-col items-center justify-center gap-4 opacity-50 h-64">
                        <Loader2 size={32} className="animate-spin text-primary" />
                        <span className="text-[11px] font-sans uppercase tracking-widest mt-2">Analyzing node...</span>
                      </div>
                    ) : (
                      <div className="markdown-body prose prose-slate max-w-none text-[14px] leading-loose">
                        <ReactMarkdown>{fileExplanation || "No explanation available."}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
                </AnimatePresence>
              </div>

              {/* Enhanced Repository Chat Section */}
              <div className="max-w-7xl mx-auto px-6 py-24">
                <div className="space-y-6">
                  <div className="flex items-center gap-4 border-b border-black/10 pb-6 mb-8">
                    <div className="min-w-0">
                      <h2 className="text-editorial-label mb-1">Intelligence Center</h2>
                      <p className="text-2xl lg:text-3xl italic font-light truncate">AI Chat with Repository</p>
                    </div>
                  </div>
                  <div className="h-[800px]">
                    <AIChat files={files} analysis={analysis} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!analysis && !isAnalyzing && (
          <footer className="mt-32 h-16 w-full border-t border-black/10 px-12 flex items-center justify-between font-sans text-[9px] uppercase tracking-[0.2em] opacity-40">
            <div className="flex gap-8">
              <span>Session ID: RL-7729-AX</span>
              <span className="sm:inline hidden">Encrypted Neural Analysis</span>
            </div>
            <div>
              CampusMind Intel Systems • 2026
            </div>
          </footer>
        )}
      </main>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 w-full md:hidden bg-black/80 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex justify-around items-center">
        <FileUp className="text-[#b9cacb]" size={20} />
        <Activity className="text-accent" size={24} />
        <Globe className="text-[#b9cacb]" size={20} />
      </nav>
    </div>
  );
}
