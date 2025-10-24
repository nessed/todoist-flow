import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress React DevTools warning in production
if (import.meta.env.PROD) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
}

createRoot(document.getElementById("root")!).render(<App />);
