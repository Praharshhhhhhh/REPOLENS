import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        const session = data?.session;
        if (session) {
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        } else {
          try {
            const { data: authListener } = supabase.auth.onAuthStateChange((event, s) => {
              if (event === 'SIGNED_IN' && s) {
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }
            });
            return () => {
              authListener?.subscription?.unsubscribe();
            };
          } catch (e) {
            console.warn('Subscription error:', e);
          }
        }
      })
      .catch((err) => {
        console.warn('Auth callback getSession error:', err);
        if (window.opener) {
          window.close();
        } else {
          window.location.href = '/';
        }
      });
  }, []);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <span className="text-sm font-sans uppercase tracking-widest animate-pulse">Authenticating with Supabase...</span>
    </div>
  );
}
