import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ConfigurationError } from './components/ConfigurationError';
import { supabase } from './lib/supabase/client';
import './index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>{supabase ? <App client={supabase} /> : <ConfigurationError />}</StrictMode>,
  );
}
