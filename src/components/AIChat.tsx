import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { askRepositoryQuestion } from '../services/aiService';
import { FileNode, RepoAnalysis } from '../types';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AIChatProps {
  files: FileNode[];
  analysis: RepoAnalysis | null;
}

export const AIChat: React.FC<AIChatProps> = ({ files, analysis }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I have analyzed the repository. What would you like to know?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsTyping(true);

    try {
      const responseText = await askRepositoryQuestion(userMessage, messages, files, analysis);
      setMessages(prev => [...prev, { role: 'model', text: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error while analyzing the repository.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-black/10 rounded-sm overflow-hidden shadow-sm relative z-10">
      <div className="bg-slate-50 border-b border-black/5 px-4 py-3 flex items-center gap-2">
        <Bot size={16} className="text-primary" />
        <h3 className="font-sans text-[11px] uppercase tracking-widest font-semibold">Repository Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#fafafa]">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-6 h-6 rounded-sm flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-black text-white' : 'bg-primary text-white'}`}>
              {msg.role === 'user' ? <User size={12} /> : <Bot size={12} />}
            </div>
            <div className={`max-w-[85%] text-[13px] leading-relaxed ${msg.role === 'user' ? 'bg-black text-white px-4 py-2 rounded-sm rounded-tr-none' : 'bg-white border border-black/5 px-4 py-2 rounded-sm rounded-tl-none shadow-sm'}`}>
              {msg.role === 'user' ? (
                <span>{msg.text}</span>
              ) : (
                <div className="markdown-body prose prose-slate prose-sm !max-w-none text-[13px]">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-6 h-6 rounded-sm bg-primary text-white flex items-center justify-center shrink-0">
               <Bot size={12} />
            </div>
            <div className="bg-white border border-black/5 px-4 py-3 rounded-sm shadow-sm flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-black/50" />
              <span className="text-[11px] text-black/50 font-sans uppercase tracking-widest">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-black/5 bg-white">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about authentication, API routes..."
            className="flex-1 bg-slate-50 border border-black/10 rounded-sm px-3 py-2 text-[13px] outline-none focus:border-primary/50 transition-colors placeholder:text-black/30"
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-primary text-white p-2 rounded-sm hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
