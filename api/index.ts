import express from 'express';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/analyzeCodebase', async (req, res) => {
  try {
    const { files, repoUrl } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    
    const groq = new Groq({ apiKey });
    
    // We should limit the payload size as Llama 3 70B has specific context window
    const filesList = JSON.stringify(files.slice(0, 100).map((f: any) => f.path));

    const prompt = `
      Analyze this repository structure and contents.
      Repository: ${repoUrl || 'Uploaded ZIP'}
      Files: ${filesList}

      Provide a comprehensive and highly detailed overview based on the structure. Expand on your descriptions, do not be brief. Return a pure JSON object containing:
      "purpose": "Very detailed, multi-sentence high-level purpose and business value of the repo",
      "architectureOverview": "Comprehensive explanation of architecture, patterns used, and how data/logic flows",
      "techStack": ["Detailed list of libraries, frameworks, languages, and tools used"],
      "entryPoint": "Main file or entry logic, including detailed reasoning",
      "importantFolders": [{"name": "Folder name or path", "description": "Highly detailed description of what this folder contains, its role in the architecture, and crucial files inside"}],
      "coreDependencies": [{"name": "Dependency name", "description": "Detailed explanation of what this dependency does across the repo and why it is used"}],
      "setupInstructions": "Detailed steps on how to set up, install dependencies, configure environment, and run the code",
      "estimatedComplexity": "Complexity assessment with a detailed justification (e.g., 'Medium: Has complex state management but few external integrations')",
      "projectStatus": "Guess of the project status with detailed reasoning (e.g., 'Active Development: recent tooling added, WIP features')"

      JSON ONLY. NO MARKDOWN. NO BACKTICKS.
    `;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const completionText = response.choices[0]?.message?.content;

    if (completionText) {
      res.json(JSON.parse(completionText));
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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    
    const groq = new Groq({ apiKey });
    
    const prompt = `
      Analyze the following file from the repository:
      File Path: ${filePath}
      Content:
      ${fileContent.substring(0, 10000)}

      Please provide a concise but deep explanation of what this file does, its role in the architecture, and any key functions or logic it contains. Format the output in Markdown.
    `;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }]
    });

    res.json({ result: response.choices[0]?.message?.content || "No explanation available." });
  } catch (error: any) {
    console.error('Error in analyzeFile:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, files, analysis } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "GROQ_API_KEY is not configured on the server." });
    
    const groq = new Groq({ apiKey });

    const relevantFilesInfo = files
      .filter((f: any) => f.type === 'file' && f.content && f.content.length > 0)
      .slice(0, 50)
      .map((f: any) => `--- FILE: ${f.path} ---\n${f.content.substring(0, 2000)}`)
      .join('\n\n');

    const systemInstruction = `You are a Repository Intelligence AI Assistant.
The user is asking questions about the following codebase.
Repository Purpose: ${analysis?.purpose || 'Unknown'}
Architecture: ${analysis?.architectureOverview || 'Unknown'}

Here are the directory and file contents gathered from the project.
${relevantFilesInfo.substring(0, 60000)}

Answer clearly, using code snippets where helpful, and reference the paths of the files you are talking about.
Be concise but expert.`;

    const messages = [];
    messages.push({ role: 'system', content: systemInstruction });
    
    for (const msg of history) {
      messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.text });
    }
    messages.push({ role: 'user', content: message });

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages as any,
      temperature: 0.3
    });

    res.json({ result: response.choices[0]?.message?.content || "I was unable to answer the question." });
  } catch (error: any) {
    console.error('Error in chat:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

export default app;

