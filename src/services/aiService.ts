import { GoogleGenAI, Type, Chat } from "@google/genai";
import { FileNode, RepoAnalysis } from "../types";

export const analyzeCodebase = async (files: { path: string; type: 'file' | 'dir' }[], repoUrl?: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Analyze this repository structure and contents.
    Repository: ${repoUrl || 'Uploaded ZIP'}
    Files: ${JSON.stringify(files.slice(0, 50).map((f: any) => f.path))}

    Provide a very deep and comprehensive overview based on the structure. Return the requested JSON format containing purpose, techStack, architectureOverview, importantFolders, entryPoint, setupInstructions, estimatedComplexity, and projectStatus.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          purpose: { type: Type.STRING, description: "High-level purpose of the repo" },
          architectureOverview: { type: Type.STRING, description: "Detailed explanation of architecture and how it works" },
          techStack: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of technologies used in the project" },
          entryPoint: { type: Type.STRING, description: "Main file or entry logic" },
          importantFolders: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Folder name or path" },
                description: { type: Type.STRING, description: "What this folder contains or is responsible for" }
              },
              required: ["name", "description"]
            }
          },
          setupInstructions: { type: Type.STRING, description: "How to set up, install dependencies and run the code" },
          estimatedComplexity: { type: Type.STRING, description: "Such as 'Low', 'Medium', 'High', 'Enterprise' or a brief description of complexity" },
          projectStatus: { type: Type.STRING, description: "Guess of the project status, e.g. 'Active', 'Inactive', 'Archived', 'Legacy'" }
        },
        required: ["purpose", "architectureOverview", "techStack", "entryPoint", "importantFolders", "setupInstructions", "estimatedComplexity", "projectStatus"]
      }
    }
  });

  if (response.text) {
    try {
      return JSON.parse(response.text);
    } catch (e) {
      throw new Error("Failed to parse AI response");
    }
  }
  throw new Error("Empty response from AI");
};

export const analyzeFile = async (filePath: string, fileContent: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = `
    Analyze the following file from the repository:
    File Path: ${filePath}
    Content:
    ${fileContent.substring(0, 15000)} // truncate to avoid token limits if too large

    Please provide a concise but deep explanation of what this file does, its role in the architecture, and any key functions or logic it contains. Format the output in Markdown.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });

  return response.text || "No explanation available.";
};

export const askRepositoryQuestion = async (
  message: string,
  history: { role: 'user' | 'model'; text: string }[],
  files: FileNode[],
  analysis: RepoAnalysis | null
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Filter files that are not empty and don't look like they are irrelevant chunks. We use slice to avoid token limit issues
  const relevantFilesInfo = files
    .filter(f => f.type === 'file' && f.content && f.content.length > 0)
    .slice(0, 100) // limit to top 100 to avoid massive token usage although gemini 1.5 pro handles a lot
    .map(f => `--- FILE: ${f.path} ---\n${f.content?.substring(0, 5000)}`) // limit content size per file loosely
    .join('\n\n');

  const systemInstruction = `You are a Repository Intelligence AI Assistant.
The user is asking questions about the following codebase.
Repository Purpose: ${analysis?.purpose || 'Unknown'}
Architecture: ${analysis?.architectureOverview || 'Unknown'}

Here are the directory and file contents gathered from the project.
${relevantFilesInfo}

Answer clearly, using code snippets where helpful, and reference the paths of the files you are talking about.
Be concise but expert.`;

  const chatConfig = {
    systemInstruction,
  };

  const chat = ai.chats.create({
    model: 'gemini-3.1-pro-preview', // Switch to 3.1-pro-preview for coding tasks
    config: chatConfig,
  });
  
  // To inject history before sending the new message with the new SDK,
  // there's no direct "history" arg in `chats.create`. The modern @google/genai requires
  // `ai.models.generateContent` for fully manually managing conversation structure or running requests in loop.
  // We'll map history to the appropriate contents structure and prepend our new message.
  
  const contents = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));
  
  // append new user message
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: contents as any,
    config: {
      systemInstruction,
      temperature: 0.3
    }
  });

  return response.text || "I was unable to answer the question.";
};
