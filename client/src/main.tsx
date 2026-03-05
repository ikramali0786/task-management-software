import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Global Suspense fallback for lazy-loaded route chunks */}
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <App />
    </Suspense>
  </React.StrictMode>
);
