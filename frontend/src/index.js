import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// ── Google Fonts — IBM Plex Mono ─────────────────────────────
const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap";
document.head.appendChild(link);

// Global reset
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; }
  input:focus { border-color: #00ff9d !important; }
  button:hover:not(:disabled) { opacity: 0.85; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
