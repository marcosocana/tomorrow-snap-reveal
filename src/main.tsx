import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Unregister service worker to avoid cache issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
