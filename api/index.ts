import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(express.json({ limit: '50mb' }));

// =========================
// HEALTH CHECK
// =========================

app.post('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =========================
// ANALYZE CODEBASE
// =========================

app.post('/api/analyzeCodebase', async (req, res) => {
  try {
    const { files, repoUrl } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
You are an expert software architect and repository analysis AI.

Analyze this repository structure and provide a detailed JSON response.

Repository:
${repoUrl || 'Uploaded ZIP'}

Files:
${JSON.stringify(
  files.slice(0, 50).map((f: any) => f.path),
  null,
  2
)}

Return ONLY valid JSON in this exact format:

{
  "purpose": "",
  "techStack": [],
  "architectureOverview": "",
  "importantFolders": [],
  "entryPoint": "",
  "setupInstructions": [],
  "estimatedComplexity": "",
  "projectStatus": ""
}
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const text = response.text || '{}';

    const parsed = JSON.parse(text);

    res.json(parsed);
  } catch (error: any) {
    console.error('Error in analyzeCodebase:', error);

    res.status(500).json({
      error: error.message || 'Internal Server Error',
    });
  }
});

// =========================
// ANALYZE SINGLE FILE
// =========================

app.post('/api/analyzeFile', async (req, res) => {
  try {
    const { filePath, fileContent } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Analyze the following file from a repository.

File Path:
${filePath}

File Content:
${fileContent.substring(0, 15000)}

Provide:
- file purpose
- architectural role
- important functions
- business logic explanation
- dependencies
- implementation summary

Format response in Markdown.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
      },
    });

    res.json({
      result: response.text || 'No explanation available.',
    });
  } catch (error: any) {
    console.error('Error in analyzeFile:', error);

    res.status(500).json({
      error: error.message || 'Internal Server Error',
    });
  }
});

// =========================
// REPOSITORY CHAT
// =========================

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, files, analysis } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const relevantFilesInfo = files
      .filter(
        (f: any) =>
          f.type === 'file' &&
          f.content &&
          f.content.length > 0
      )
      .slice(0, 100)
      .map(
        (f: any) =>
          `--- FILE: ${f.path} ---\n${f.content.substring(0, 5000)}`
      )
      .join('\n\n');

    const systemInstruction = `
You are an expert Repository Intelligence AI Assistant.

Repository Purpose:
${analysis?.purpose || 'Unknown'}

Architecture:
${analysis?.architectureOverview || 'Unknown'}

Repository Files:
${relevantFilesInfo}

Instructions:
- Answer clearly
- Reference file paths
- Explain architecture
- Use code snippets when useful
- Be concise but technically deep
`;

    const contents = history.map((msg: any) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({
      result:
        response.text ||
        'I was unable to answer the question.',
    });
  } catch (error: any) {
    console.error('Error in chat:', error);

    res.status(500).json({
      error: error.message || 'Internal Server Error',
    });
  }
});

export default app;
