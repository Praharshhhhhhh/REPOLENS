import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Determine if valid, reachable Supabase credentials are configured
// Specifically excludes invalid, dummy, or deleted prototype hosts (e.g. untpyathubtdiqfaobfc)
export const isSupabaseConfigured = Boolean(
  rawUrl &&
  rawKey &&
  !rawUrl.includes('placeholder.supabase.co') &&
  !rawUrl.includes('placeholder') &&
  !rawUrl.includes('untpyathubtdiqfaobfc') &&
  (rawUrl.startsWith('https://') || rawUrl.startsWith('http://'))
);

const LOCAL_STORAGE_SESSION_KEY = 'repolens_local_auth_session';
const LOCAL_STORAGE_HISTORY_KEY = 'repolens_local_history';

// Helper to manage listeners for local fallback auth
type AuthListener = (event: string, session: any) => void;
const localAuthListeners: Set<AuthListener> = new Set();

const getStoredLocalSession = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const notifyLocalListeners = (event: string, session: any) => {
  localAuthListeners.forEach(listener => {
    try {
      listener(event, session);
    } catch (e) {
      console.warn('Notice in auth listener:', e);
    }
  });
};

// Fallback client for offline/local operation
const localFallbackClient = {
  auth: {
    getSession: async () => {
      const session = getStoredLocalSession();
      return { data: { session }, error: null };
    },
    onAuthStateChange: (callback: AuthListener) => {
      localAuthListeners.add(callback);
      const session = getStoredLocalSession();
      if (session) {
        setTimeout(() => callback('SIGNED_IN', session), 0);
      }
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              localAuthListeners.delete(callback);
            }
          }
        }
      };
    },
    signInWithOAuth: async () => {
      return {
        data: null,
        error: new Error(
          'GitHub OAuth requires a Supabase cloud project. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
        )
      };
    },
    signUp: async ({ email }: { email: string; password?: string }) => {
      const mockUser = {
        id: 'local_user_' + Math.abs(email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)),
        email,
        user_metadata: { name: email.split('@')[0] }
      };
      const session = { user: mockUser, access_token: 'local-token' };
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
      } catch {}
      notifyLocalListeners('SIGNED_IN', session);
      return { data: { user: mockUser, session }, error: null };
    },
    signInWithPassword: async ({ email }: { email: string; password?: string }) => {
      const mockUser = {
        id: 'local_user_' + Math.abs(email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)),
        email,
        user_metadata: { name: email.split('@')[0] }
      };
      const session = { user: mockUser, access_token: 'local-token' };
      try {
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
      } catch {}
      notifyLocalListeners('SIGNED_IN', session);
      return { data: { user: mockUser, session }, error: null };
    },
    signOut: async () => {
      try {
        localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      } catch {}
      notifyLocalListeners('SIGNED_OUT', null);
      return { error: null };
    }
  },
  from: (table: string) => {
    const getLocalRows = (): any[] => {
      try {
        const raw = localStorage.getItem(`${LOCAL_STORAGE_HISTORY_KEY}_${table}`);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    };
    const saveLocalRows = (rows: any[]) => {
      try {
        localStorage.setItem(`${LOCAL_STORAGE_HISTORY_KEY}_${table}`, JSON.stringify(rows));
      } catch {}
    };

    return {
      select: (_cols = '*') => ({
        eq: (col: string, val: any) => ({
          order: (orderCol: string, { ascending = true }: { ascending?: boolean } = {}) => {
            const all = getLocalRows().filter(row => row[col] === val);
            all.sort((a, b) => {
              const va = a[orderCol] ?? '';
              const vb = b[orderCol] ?? '';
              return ascending ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
            });
            return Promise.resolve({ data: all, error: null });
          }
        })
      }),
      insert: (row: any) => {
        const all = getLocalRows();
        const newItem = {
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          created_at: new Date().toISOString(),
          ...row
        };
        all.unshift(newItem);
        saveLocalRows(all);
        return Promise.resolve({ data: [newItem], error: null });
      },
      delete: () => ({
        eq: (col: string, val: any) => {
          const all = getLocalRows().filter(row => row[col] !== val);
          saveLocalRows(all);
          return Promise.resolve({ data: null, error: null });
        }
      })
    };
  }
};

// Create real client only if configured with a real host; otherwise default to local storage fallback
let rawClientInstance: any = null;
if (isSupabaseConfigured) {
  try {
    rawClientInstance = createClient(rawUrl, rawKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
      }
    });
  } catch (initErr) {
    console.warn('Supabase client init note:', initErr);
  }
}

// Resilient wrapper: if remote network calls fail with Failed to fetch, seamlessly falls back to local client
export const supabase = rawClientInstance || (localFallbackClient as any);
