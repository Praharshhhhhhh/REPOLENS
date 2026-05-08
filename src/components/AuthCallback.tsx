import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
       if (session) {
           if (window.opener) {
               window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
               window.close();
           } else {
               window.location.href = '/';
           }
       } else {
          // Sometimes it takes a moment for the session to be processed from the hash
          const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
              if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  window.close();
              } else {
                  window.location.href = '/';
              }
            }
          });
          return () => {
             authListener.subscription.unsubscribe();
          }
       }
    });
  }, []);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
       <span className="text-sm font-sans uppercase tracking-widest animate-pulse">Authenticating with Supabase...</span>
    </div>
  );
}
