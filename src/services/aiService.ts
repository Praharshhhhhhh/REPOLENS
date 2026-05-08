import { FileNode, RepoAnalysis } from "../types";

export const analyzeCodebase = async (files: { path: string; type: 'file' | 'dir' }[], repoUrl?: string) => {
  const response = await fetch('/api/analyzeCodebase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, repoUrl }),
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
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, files, analysis }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to ask question");
  }

  const data = await response.json();
  return data.result;
};

