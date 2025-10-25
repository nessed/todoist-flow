import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress React DevTools warning in production
if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

// --- Add Service Worker Registration with update flow (BEFORE rendering the app) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Notify on updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller // existing page is controlled => this is an update
            ) {
              // Simple UX: prompt to update now
              const shouldUpdate = window.confirm(
                'A new version of DoneGlow is available. Update now?'
              );
              if (shouldUpdate) {
                // Ask the waiting worker to take over
                registration.waiting?.postMessage('SKIP_WAITING');
                // Reload when controller changes to the new SW
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload();
                });
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
// --- End Registration ---

// --- Render the app ONCE ---
createRoot(document.getElementById("root")!).render(<App />);
