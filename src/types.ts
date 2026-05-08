export interface FileNode {
    path: string;
    type: 'file' | 'dir';
    content?: string;
}

export interface RepoAnalysis {
    purpose: string;
    architectureOverview: string;
    techStack: string[];
    importantFolders: { name: string; description: string }[];
    coreDependencies: { name: string; description: string }[];
    entryPoint: string;
    setupInstructions: string;
    estimatedComplexity: string;
    projectStatus: string;
}
