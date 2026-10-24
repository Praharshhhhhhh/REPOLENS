import { createClient } from '@supabase/supabase-js';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

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

// ============================================================
// Amazon RDS Backend Client + Automatic Local Storage Fallback
// ============================================================
const rdsAndLocalClient = {
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
          'Please sign in using Email & Password (connected to Amazon RDS PostgreSQL).'
        )
      };
    },
    signUp: async ({ email, password }: { email: string; password?: string }) => {
      // 1. Try Amazon RDS Backend first
      try {
        const res = await fetch('/api/db/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (res.status !== 503) {
          const data = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(data.error || 'Signup failed') };
          }
          try {
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(data.session));
          } catch {}
          notifyLocalListeners('SIGNED_IN', data.session);
          return { data: { user: data.user, session: data.session }, error: null };
        }
      } catch (_) {
        // Fall through to local fallback if RDS is not configured
      }

      // 2. Local Fallback
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
    signInWithPassword: async ({ email, password }: { email: string; password?: string }) => {
      // 1. Try Amazon RDS Backend first
      try {
        const res = await fetch('/api/db/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (res.status !== 503) {
          const data = await res.json();
          if (!res.ok) {
            return { data: null, error: new Error(data.error || 'Invalid login credentials') };
          }
          try {
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(data.session));
          } catch {}
          notifyLocalListeners('SIGNED_IN', data.session);
          return { data: { user: data.user, session: data.session }, error: null };
        }
      } catch (_) {
        // Fall through to local fallback if RDS is not configured
      }

      // 2. Local Fallback
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
          order: async (orderCol: string, { ascending = true }: { ascending?: boolean } = {}) => {
            if (table === 'repo_history' && col === 'user_id') {
              try {
                const res = await fetch(`/api/db/history?user_id=${encodeURIComponent(val)}`);
                if (res.ok) {
                  const json = await res.json();
                  return { data: json.data || [], error: null };
                }
              } catch (_) {}
            }
            const all = getLocalRows().filter(row => row[col] === val);
            all.sort((a, b) => {
              const va = a[orderCol] ?? '';
              const vb = b[orderCol] ?? '';
              return ascending ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
            });
            return { data: all, error: null };
          }
        })
      }),
      insert: async (row: any) => {
        if (table === 'repo_history') {
          try {
            const res = await fetch('/api/db/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(row)
            });
            if (res.ok) {
              const json = await res.json();
              return { data: json.data, error: null };
            }
          } catch (_) {}
        }
        const all = getLocalRows();
        const newItem = {
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          created_at: new Date().toISOString(),
          ...row
        };
        all.unshift(newItem);
        saveLocalRows(all);
        return { data: [newItem], error: null };
      },
      delete: () => ({
        eq: async (col: string, val: any) => {
          if (table === 'repo_history' && col === 'id') {
            try {
              const res = await fetch(`/api/db/history/${encodeURIComponent(val)}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                return { data: null, error: null };
              }
            } catch (_) {}
          }
          const all = getLocalRows().filter(row => row[col] !== val);
          saveLocalRows(all);
          return { data: null, error: null };
        }
      })
    };
  }
};

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

export const supabase = rawClientInstance || (rdsAndLocalClient as any);
