import { FileNode, RepoAnalysis } from "../types";

export const analyzeCodebase = async (files: { path: string; type: 'file' | 'dir' }[], repoUrl?: string): Promise<RepoAnalysis> => {
  // Only send the paths, without file contents, to keep payload size tiny
  const filesPayload = files.map(f => ({ path: f.path, type: f.type }));
  const response = await fetch('/api/analyzeCodebase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: filesPayload, repoUrl }),
  });
  
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    const rawText = await response.text();
    let errMessage = `Failed to analyze codebase (${response.status})`;
    try {
      const errorData = JSON.parse(rawText);
      if (errorData?.error) errMessage = errorData.error;
    } catch {
      if (rawText.includes('<!doctype') || rawText.includes('<html')) {
        errMessage = 'AI analysis service temporarily returned HTML. Please retry.';
      } else if (rawText) {
        errMessage = rawText;
      }
    }
    throw new Error(errMessage);
  }
  
  return await response.json();
};

export const analyzeFile = async (filePath: string, fileContent: string): Promise<string> => {
  const response = await fetch('/api/analyzeFile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, fileContent }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    const rawText = await response.text();
    let errMessage = `Failed to analyze file (${response.status})`;
    try {
      const errorData = JSON.parse(rawText);
      if (errorData?.error) errMessage = errorData.error;
    } catch {
      if (rawText.includes('<!doctype') || rawText.includes('<html')) {
        errMessage = 'File analysis service is temporarily unavailable. Please retry in a moment.';
      } else if (rawText) {
        errMessage = rawText;
      }
    }
    throw new Error(errMessage);
  }

  const data = await response.json();
  return data.result;
};

export const askRepositoryQuestion = async (
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  files: FileNode[],
  analysis: RepoAnalysis | null
): Promise<string> => {
  // Keep file payload lightweight: send paths for structural map, and excerpts of files with content
  const payloadFiles = files.slice(0, 150).map(f => {
    if (f.type === 'file' && f.content) {
      return {
        path: f.path,
        type: f.type,
        content: f.content.substring(0, 1500)
      };
    }
    return {
      path: f.path,
      type: f.type
    };
  });

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message, 
      history: history.slice(-6), 
      files: payloadFiles, 
      analysis 
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('application/json')) {
    let errMessage = `Error (${response.status}): Failed to get AI response`;
    try {
      const errorData = await response.json();
      if (errorData?.error) errMessage = errorData.error;
    } catch {
      const rawText = await response.text();
      if (rawText.includes('<!doctype') || rawText.includes('<html')) {
        errMessage = 'Chat service temporarily unavailable (received HTML). Please wait a moment and retry.';
      } else if (rawText) {
        errMessage = rawText;
      }
    }
    throw new Error(errMessage);
  }

  const data = await response.json();
  return data.result;
};
