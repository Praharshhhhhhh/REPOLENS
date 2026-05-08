import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthCallback } from './components/AuthCallback.tsx';
import './index.css';

const path = window.location.pathname;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/auth/callback' || path === '/auth/callback/' ? (
      <AuthCallback />
    ) : (
      <App />
    )}
  </StrictMode>,
);
