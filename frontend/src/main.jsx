import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

const Main = () => {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/env.json')
      .then(res => res.json())
      .then(data => {
        window.ENV_CONFIG = data; // Make available globally for services
        setConfig(data);
      })
      .catch(err => {
        console.error("Failed to load env.json:", err);
        setError("Configuration failed to load. Please check if env.json exists.");
      });
  }, []);

  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;
  if (!config) return <div style={{ padding: '20px' }}>Loading configuration...</div>;

  return (
    <React.StrictMode>
      <GoogleOAuthProvider clientId={config.VITE_GOOGLE_CLIENT_ID || ""}>
        <App />
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Main />);
