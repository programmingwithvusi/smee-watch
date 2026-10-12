import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element is missing from index.html");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Only in the production build: the dev server's on-the-fly module serving doesn't play well with
// a caching service worker, and there's nothing worth caching before a real deploy anyway.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.error("service worker registration failed", err);
    });
  });
}
