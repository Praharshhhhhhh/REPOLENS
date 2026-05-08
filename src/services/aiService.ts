import { FileNode, RepoAnalysis } from "../types";

export const analyzeCodebase = async (files: { path: string; type: 'file' | 'dir' }[], repoUrl?: string) => {
  // Only send the paths, without file contents, to keep payload size tiny
  const filesPayload = files.map(f => ({ path: f.path, type: f.type }));
  const response = await fetch('/api/analyzeCodebase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: filesPayload, repoUrl }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to analyze codebase");
  }
  
  return await response.json();
};

export const analyzeFile = async (filePath: string, fileContent: string) => {
  const response = await fetch('/api/analyzeFile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, fileContent }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to analyze file");
  }

  const data = await response.json();
  return data.result;
};

export const askRepositoryQuestion = async (
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  files: FileNode[],
  analysis: RepoAnalysis | null
) => {
  // Only send the top 100 files with up to 5000 chars of content to avoid payload issues
  const relevantFiles = files
    .filter(f => f.type === 'file' && f.content && f.content.length > 0)
    .slice(0, 100)
    .map(f => ({
      ...f,
      content: f.content?.substring(0, 5000)
    }));

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, files: relevantFiles, analysis }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to ask question");
  }

  const data = await response.json();
  return data.result;
};

