import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Github, FileUp, ChevronRight, Bolt, Shield, Activity, Globe, ArrowLeft, Loader2, Search, LogOut, History, User, Mail, Trash2, Key, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import { analyzeCodebase } from './services/aiService';
import { fetchRepositoryData, fetchFileContent, parseGitHubUrl, getStoredGitHubToken, setStoredGitHubToken } from './services/githubService';
import { FileNode, RepoAnalysis } from './types';
import { RepoVisualizer } from './components/RepoVisualizer';
import { LandingPage } from './components/LandingPage';
import { AIChat } from './components/AIChat';
import ReactMarkdown from 'react-markdown';
import { FloatingPaths } from './components/ui/background-paths';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // GitHub Personal Access Token management (bypasses 60 req/hr rate limit or accesses private repos)
  const [githubToken, setGithubToken] = useState<string>(() => getStoredGitHubToken());
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>('main');

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }: any) => {
        const session = data?.session;
        setUser(session?.user ?? null);
        if (session?.user) fetchHistory(session.user.id);
      })
      .catch((err: any) => {
        console.warn('Initial session check notice:', err?.message || err);
      });

    let subscription: any = null;
    try {
      const res = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchHistory(session.user.id);
      });
      subscription = res?.data?.subscription;
    } catch (err: any) {
      console.warn('Auth state change subscription error:', err?.message || err);
    }

    return () => {
      subscription?.unsubscribe?.();
    };
  }, []);

  const fetchHistory = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('repo_history').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (error) {
        console.warn('Notice fetching history:', error.message || error);
      }
      if (data) setHistory(data);
    } catch (err: any) {
      console.warn('Failed to query user history records:', err?.message || err);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      setAuthError('');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const authWindow = window.open(data.url, 'oauth_popup', 'width=600,height=700');
        if (!authWindow) {
          alert('Please allow popups for this site to connect your account.');
        }
      }
    } catch (err: any) {
      console.error('Unexpected error during login:', err);
      setAuthError(err.message || 'Unknown error');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        if (isSupabaseConfigured) {
          alert('Sign up successful! Please check your email for verification.');
        } else {
          setShowAuthModal(false);
          setAuthEmail('');
          setAuthPassword('');
        }
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setHistory([]);
    } catch (err: any) {
      console.warn('Sign out notice:', err?.message || err);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('repo_history').delete().eq('id', id);
      if (error) throw error;
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      console.error('Failed to delete history record:', err.message);
      alert('Failed to delete history record: ' + err.message);
    }
  };

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

    let displayFile = { ...file };
    let fetchedContent = file.content;

    setSelectedFile(displayFile);
    setFileExplanation(null);
    setIsExplaining(true);

    // If file content isn't pre-loaded, fetch via our rate-limit-immune raw proxy
    if (!fetchedContent && repoUrl && repoUrl.includes('github.com')) {
      try {
        const parsed = parseGitHubUrl(repoUrl);
        if (parsed) {
          fetchedContent = await fetchFileContent(
            parsed.owner,
            parsed.repo,
            currentBranch,
            file.path,
            githubToken
          );
          displayFile.content = fetchedContent;
          setSelectedFile({ ...displayFile });
        }
      } catch (err) {
        console.error("Failed to fetch raw file", err);
      }
    }

    try {
      import('./services/aiService').then(async ({ analyzeFile }) => {
        try {
          const result = await analyzeFile(displayFile.path, fetchedContent || "Content unavailable or excluded.");
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
  }, [files, repoUrl, currentBranch, githubToken]);

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);
    setRateLimitNotice(null);
    try {
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const content = await zip.loadAsync(file);
        const extractedFiles: FileNode[] = [];
        
        for (const [path, zipEntry] of Object.entries(content.files)) {
          if (!zipEntry.dir) {
            if (path.includes('node_modules/') || path.includes('.git/') || path.includes('dist/') || path.includes('build/')) {
              continue;
            }
            let fileContent;
            if (!path.match(/\.(png|jpg|jpeg|gif|ico|pdf|zip|tar|gz|mp4|webp|svg|woff|woff2|ttf|eot)$/i)) {
              try {
                fileContent = await zipEntry.async("string");
              } catch (_) {}
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

        if (user) {
          try {
            const archiveUrl = `Archive: ${file.name}`;
            const { error: dbError } = await supabase.from('repo_history').insert({ user_id: user.id, repo_url: archiveUrl });
            if (dbError) {
              console.warn("History save note:", dbError.message);
            }
            fetchHistory(user.id);
          } catch (histErr) {
            console.warn("History save note:", histErr);
          }
        }
      } else {
        setError('Please upload a ZIP file or provide a valid GitHub link.');
      }
    } catch (err: any) {
      console.error("ZIP processing error:", err);
      setError(err.message || 'Archive processing failed. Please verify file integrity.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const decodeRepo = async (urlToDecode?: string | React.MouseEvent) => {
    const url = typeof urlToDecode === 'string' ? urlToDecode : repoUrl;
    if (!url) return;
    if (url.startsWith('Archive:')) {
      alert("Local archive files cannot be re-loaded from history.");
      return;
    }
    
    // Validate if it is a correct GitHub URL
    const githubRegex = /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+/;
    if (!githubRegex.test(url)) {
      setError('Invalid URL: Please provide a valid GitHub repository link (e.g., https://github.com/user/repo).');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setRateLimitNotice(null);

    try {
      // Ingest repository files via multi-tier fallback pipeline (immune to GitHub 60 req/hr limit)
      const repoData = await fetchRepositoryData(url, githubToken);
      
      setCurrentBranch(repoData.defaultBranch || 'main');
      setFiles(repoData.files);

      if (repoData.rateLimitBypassed) {
        setRateLimitNotice(repoData.message || 'Loaded via high-speed archive pipeline to bypass GitHub API rate limit.');
      }

      const result = await analyzeCodebase(repoData.files, url);
      setAnalysis(result);
      
      if (user) {
        try {
          const { error } = await supabase.from('repo_history').insert({ user_id: user.id, repo_url: url });
          if (error) {
            console.warn("History save note:", error.message);
          }
          fetchHistory(user.id);
        } catch (histErr) {
          console.warn("History save note:", histErr);
        }
      }
    } catch (err: any) {
      console.error("Decode error:", err);
      setError(err.message || 'Failed to fetch repository data.');
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
        
        <div className="hidden md:flex items-center gap-8 font-sans text-[11px] uppercase tracking-widest opacity-60">
          <button 
            onClick={() => {
              setTokenInput(githubToken);
              setShowTokenModal(true);
            }} 
            className="hover:opacity-100 transition-opacity flex items-center gap-1.5"
            title="Configure GitHub Personal Access Token to increase rate limits to 5,000/hr"
          >
            <Key size={12} className={githubToken ? "text-emerald-600" : ""} />
            <span>{githubToken ? 'Token (Active)' : 'GitHub Token'}</span>
            {githubToken && <CheckCircle size={10} className="text-emerald-600" />}
          </button>

          <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="hover:opacity-100 transition-opacity">Platform</a>
          <a href="https://github.com/Praharshhhhhhh/REPOLENS" target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity">Documentation</a>
          {user ? (
             <>
               <button onClick={() => setShowHistory(!showHistory)} className="hover:opacity-100 transition-opacity flex items-center gap-1"><History size={12}/> History</button>
               <button onClick={handleLogout} className="hover:opacity-100 transition-opacity flex items-center gap-1"><LogOut size={12}/> Sign Out</button>
             </>
          ) : (
             <button onClick={() => setShowAuthModal(true)} className="hover:opacity-100 transition-opacity flex items-center gap-1"><User size={12}/> Sign In</button>
          )}
        </div>

        <button 
          onClick={() => {
            setAnalysis(null);
            setFiles([]);
            setRateLimitNotice(null);
            setTimeout(() => {
              const repoInput = document.querySelector('input') as HTMLInputElement;
              if (repoInput) {
                repoInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => repoInput.focus({ preventScroll: true }), 300);
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }, 100);
          }}
          className="bg-primary text-on-primary py-2.5 px-8 font-sans text-[11px] uppercase tracking-[0.2em] hover:bg-black transition-all">
          Generate Intel
        </button>
      </nav>

      {/* GitHub Token Modal */}
      <AnimatePresence>
        {showTokenModal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowTokenModal(false);
            }}
          >
            <div className="bg-white border border-black/10 shadow-2xl p-8 max-w-md w-full relative">
              <button 
                onClick={() => setShowTokenModal(false)}
                className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity"
              >✕</button>
              
              <div className="flex items-center gap-2 mb-2">
                <Key size={18} className="text-primary" />
                <h2 className="text-xl font-bold font-sans">GitHub Access Token</h2>
              </div>
              
              <p className="text-xs text-black/60 font-sans leading-relaxed mb-4">
                Unauthenticated requests to the GitHub API are limited to 60 requests/hour. Adding a Personal Access Token increases your limit to <strong>5,000 requests/hour</strong> and unlocks access to private repositories.
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest opacity-60 mb-1 font-sans">Personal Access Token (PAT)</label>
                  <input 
                    type="password" 
                    placeholder="ghp_... or github_pat_..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full border border-black/10 px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="text-[11px] text-black/60 bg-slate-50 p-3 rounded border border-slate-200 leading-normal">
                  <span className="font-semibold block mb-0.5 text-black">Private & Stored Locally</span>
                  Your token is stored only in your browser local storage and sent with requests to GitHub. Public repositories also use our automatic archive pipeline if rate-limited.
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                {githubToken ? (
                  <button
                    onClick={() => {
                      setStoredGitHubToken('');
                      setGithubToken('');
                      setTokenInput('');
                      setShowTokenModal(false);
                    }}
                    className="text-xs text-red-600 hover:underline uppercase tracking-wider font-sans"
                  >
                    Remove Token
                  </button>
                ) : <div />}
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTokenModal(false)}
                    className="px-4 py-2 text-xs uppercase tracking-wider border border-black/10 hover:bg-black/5 font-sans"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setStoredGitHubToken(tokenInput);
                      setGithubToken(tokenInput.trim());
                      setShowTokenModal(false);
                    }}
                    className="bg-black text-white px-5 py-2 text-xs uppercase tracking-wider hover:bg-neutral-800 font-sans"
                  >
                    Save Token
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAuthModal(false);
            }}
          >
            <div className="bg-white border border-black/10 shadow-2xl p-8 max-w-sm w-full relative">
              <button 
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity"
              >✕</button>
              
              <h2 className="text-xl font-bold mb-3 font-sans">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>

              {!isSupabaseConfigured && (
                <div className="mb-4 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 p-2.5 rounded-sm">
                  <span className="font-semibold text-slate-800 block mb-0.5">Local Storage Mode</span>
                  Cloud Supabase is not configured. Creating an account or signing in will safely save your decoded repository history in your browser local storage.
                </div>
              )}
              
              {authError && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm border border-red-200">
                  {authError}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest opacity-60 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full border border-black/10 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest opacity-60 mb-1">Password</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full border border-black/10 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-primary text-on-primary py-2 text-xs font-sans uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {authLoading && <Loader2 size={14} className="animate-spin" />}
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </button>
              </form>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/10" /></div>
                <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-white px-2 text-muted">Or</span></div>
              </div>

              <button
                type="button"
                onClick={handleOAuthLogin}
                className="w-full border border-black/10 py-2.5 px-4 text-xs font-sans uppercase tracking-widest hover:bg-black/5 transition-colors flex items-center justify-center gap-2 mb-4"
              >
                <Github size={14} /> Continue with GitHub
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError('');
                  }}
                  className="text-xs text-primary/60 hover:text-primary transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-full w-80 bg-white border-l border-black/10 shadow-2xl z-50 flex flex-col p-6 overflow-y-auto pt-24"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-sans uppercase tracking-widest font-semibold">Decoded Nodes History</h3>
              <button onClick={() => setShowHistory(false)} className="opacity-50 hover:opacity-100">✕</button>
            </div>
            {history.length === 0 ? (
              <div className="text-[12px] opacity-50 italic">No history recorded yet. Add a GitHub URL to begin parsing.</div>
            ) : (
              <div className="space-y-4">
                {history.map((item, idx) => (
                  <div key={idx} className="p-3 border border-black/10 rounded-sm hover:bg-black/5 cursor-pointer transition-colors flex justify-between items-start gap-2" onClick={() => {
                    setRepoUrl(item.repo_url);
                    setShowHistory(false);
                    setTimeout(() => decodeRepo(item.repo_url), 100);
                  }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase opacity-50 mb-1">{new Date(item.created_at).toLocaleDateString()}</div>
                      <div className="text-[13px] font-mono break-all">{item.repo_url}</div>
                    </div>
                    <button 
                      onClick={(e) => handleDeleteHistory(item.id, e)} 
                      className="p-1.5 opacity-40 hover:opacity-100 hover:text-red-500 transition-colors shrink-0 rounded-sm"
                      title="Delete from history"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
                onOpenTokenModal={() => {
                  setTokenInput(githubToken);
                  setShowTokenModal(true);
                }}
                hasGitHubToken={!!githubToken}
              />
            </motion.div>
          ) : isAnalyzing ? (
            <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 relative z-10">
              <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40 z-[0]">
                <FloatingPaths position={1} />
                <FloatingPaths position={-1} />
              </div>
              <div className="flex flex-col items-center gap-4 relative z-10">
                <Loader2 size={36} className="animate-spin text-primary" />
                <span className="text-editorial-label animate-pulse">Mapping Neural Nodes & Decoding Repo...</span>
                <div className="h-px w-32 bg-primary/20" />
                <p className="italic font-light text-muted text-sm">Synthesizing architecture and vectorizing nodes.</p>
              </div>
            </div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="min-h-screen bg-background pt-[80px] z-40 relative pb-16"
            >
              {/* Background Paths */}
              <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-40 z-[0]">
                <FloatingPaths position={1} />
                <FloatingPaths position={-1} />
              </div>

              {/* Summary Section */}
              <div className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-12 relative z-10">
                
                {/* Rate limit bypass notification banner */}
                {rateLimitNotice && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-sky-50 border border-sky-200 text-sky-950 px-4 py-3 rounded-sm text-xs font-sans flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold uppercase tracking-wider text-[10px] bg-sky-200/80 text-sky-900 px-2 py-0.5 rounded">
                        Rate-Limit Bypass Active
                      </span>
                      <span>{rateLimitNotice}</span>
                    </div>
                    <button 
                      onClick={() => setRateLimitNotice(null)} 
                      className="text-sky-600 hover:text-sky-900 text-sm font-bold px-1"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}

                {/* Header Info */}
                <div className="space-y-6 border-b border-black/10 pb-8">
                  <div className="flex items-center gap-4">
                     <button 
                      onClick={() => { setAnalysis(null); setFiles([]); setRateLimitNotice(null); }}
                      className="h-10 w-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-black hover:text-white transition-all shrink-0"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="text-[10px] font-sans text-black/50 tracking-widest uppercase mb-1">System Stage</p>
                        {currentBranch && (
                          <span className="text-[10px] font-mono text-black/40 border border-black/10 px-1.5 py-0.5 rounded">
                            branch: {currentBranch}
                          </span>
                        )}
                      </div>
                      <h2 className="text-2xl lg:text-3xl italic font-light truncate">{repoUrl || 'Project Archive'}</h2>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap pt-2">
                    {analysis?.techStack.map(tech => (
                      <span key={tech} className="text-[10px] uppercase tracking-widest font-sans opacity-60 px-3 py-1.5 border border-black/10 rounded-sm">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Intelligence Metadata Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
                    <span className="text-[15px] font-medium">{files.length} Total Nodes</span>
                  </div>
                </div>

                {/* Architecture & Purpose */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-black/10">
                  <div className="space-y-4">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Mission Purpose</h3>
                    <p className="text-[14px] font-sans leading-relaxed text-black/80">{analysis?.purpose}</p>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Architectural Blueprint</h3>
                    <p className="text-[14px] font-sans leading-relaxed text-black/80">{analysis?.architectureOverview}</p>
                  </div>
                </div>

                {/* Key Features & Primary Use Cases */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-black/10">
                  <div className="space-y-6">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Key Features</h3>
                    <div className="space-y-6 pt-2">
                      {analysis?.keyFeatures?.map((feature, i) => (
                        <div key={i} className="group">
                          <h4 className="text-[14px] font-medium font-sans mb-1 group-hover:text-primary transition-colors">{feature.name}</h4>
                          <p className="text-[13px] font-sans leading-relaxed text-black/60 mt-1">{feature.description}</p>
                        </div>
                      ))}
                      {!analysis?.keyFeatures?.length && (
                        <p className="text-[13px] font-sans leading-relaxed text-black/50">No prominent features identified.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Primary Use Cases</h3>
                    <div className="space-y-4 pt-2">
                       {analysis?.primaryUseCases?.map((useCase, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary/30 mt-2 shrink-0"></div>
                          <p className="text-[14px] font-sans leading-relaxed text-black/80">{useCase}</p>
                        </div>
                      ))}
                      {!analysis?.primaryUseCases?.length && (
                        <p className="text-[13px] font-sans leading-relaxed text-black/50">No main use cases identified.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Folders & Dependencies */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-black/10">
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

                  <div className="space-y-6">
                    <h3 className="text-editorial-label italic border-b border-black/5 pb-2">Core Dependencies</h3>
                    <div className="space-y-6 pt-2">
                      {analysis?.coreDependencies?.map(dep => (
                        <div key={dep.name} className="group">
                          <h4 className="text-[13px] font-medium font-sans mb-1 group-hover:text-primary transition-colors cursor-pointer break-all">{dep.name}</h4>
                          <p className="text-[12px] font-sans leading-relaxed text-black/50 uppercase tracking-wider mt-2">{dep.description}</p>
                        </div>
                      ))}
                      {!analysis?.coreDependencies?.length && (
                        <p className="text-[12px] font-sans leading-relaxed text-black/50 uppercase tracking-wider">No significant dependencies identified.</p>
                      )}
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
              <div className="max-w-7xl mx-auto px-6 py-24 relative z-10">
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
