import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/analyzeCodebase', async (req, res) => {
  try {
    const { files, repoUrl } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    const ai = new GoogleGenAI({ apiKey });
    
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
            projectStatus: { type: Type.STRING, description: "Guess of the project status" }
          },
          required: ["purpose", "architectureOverview", "techStack", "entryPoint", "importantFolders", "setupInstructions", "estimatedComplexity", "projectStatus"]
        }
      }
    });

    if (response.text) {
      res.json(JSON.parse(response.text));
    } else {
      res.status(500).json({ error: "Empty response from AI" });
    }
  } catch (error: any) {
    console.error('Error in analyzeCodebase:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/analyzeFile', async (req, res) => {
  try {
    const { filePath, fileContent } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Analyze the following file from the repository:
      File Path: ${filePath}
      Content:
      ${fileContent.substring(0, 15000)}

      Please provide a concise but deep explanation of what this file does, its role in the architecture, and any key functions or logic it contains. Format the output in Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    res.json({ result: response.text || "No explanation available." });
  } catch (error: any) {
    console.error('Error in analyzeFile:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, files, analysis } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
    const ai = new GoogleGenAI({ apiKey });

    const relevantFilesInfo = files
      .filter((f: any) => f.type === 'file' && f.content && f.content.length > 0)
      .slice(0, 100)
      .map((f: any) => `--- FILE: ${f.path} ---\n${f.content.substring(0, 5000)}`)
      .join('\n\n');

    const systemInstruction = `You are a Repository Intelligence AI Assistant.
The user is asking questions about the following codebase.
Repository Purpose: ${analysis?.purpose || 'Unknown'}
Architecture: ${analysis?.architectureOverview || 'Unknown'}

Here are the directory and file contents gathered from the project.
${relevantFilesInfo}

Answer clearly, using code snippets where helpful, and reference the paths of the files you are talking about.
Be concise but expert.`;

    const contents = history.map((msg: any) => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.3
      }
    });

    res.json({ result: response.text || "I was unable to answer the question." });
  } catch (error: any) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default app;
