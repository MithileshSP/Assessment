import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles/index.css";
import { GoogleOAuthProvider } from "@react-oauth/google";

console.log("%c DEPLOYMENT VERSION: v3.4.25 (Stable) ", "background: #1e293b; color: #3b82f6; font-weight: bold; border-left: 4px solid #3b82f6;");

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!clientId) {
  console.warn(
    "VITE_GOOGLE_CLIENT_ID is not set; Google Sign-In will not render correctly."
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId || ""}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
