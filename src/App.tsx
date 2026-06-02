// ─────────────────────────────────────────────────────────────
// Tarjama — App Root
// ─────────────────────────────────────────────────────────────

import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useSettingsStore } from './store/settingsStore';
import { THEME } from './utils/constants';

// ── Lazy-loaded Pages ───────────────────────────────────────

const UploadPage = lazy(() => import('./pages/UploadPage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));

// ── Loading Spinner ─────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner" />
      <p className="loading-spinner-text">Loading…</p>
    </div>
  );
}

// ── App ─────────────────────────────────────────────────────

export default function App() {
  const theme = useSettingsStore((s) => s.theme);

  // Apply CSS custom properties to :root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    const vars = THEME[theme];

    Object.entries(vars).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Also set a data attribute for conditional CSS selectors
    root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <BrowserRouter>
      <div className={`app-root theme-${theme}`}>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/project/:id" element={<WorkspacePage />} />
          </Routes>
        </Suspense>

        <Toaster
          position="bottom-right"
          theme={theme}
          richColors
          closeButton
          toastOptions={{
            style: {
              fontFamily: "'Inter', sans-serif",
            },
          }}
        />
      </div>
    </BrowserRouter>
  );
}
