import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { clearAdminSession, notifySessionChange } from "../utils/session";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { RefreshCw } from "lucide-react";

export default function Login({ isAdmin = false, onLogin }) {
  const navigate = useNavigate();
  const { onLoginSuccess } = useAuth();
  const [credentials, setCredentials] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validation
    if (!credentials.username || !credentials.password) {
      setError("Please enter both username and password");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Use API client to hit the centralized auth endpoint
      // Backend sets HttpOnly cookie 'authToken' automatically
      const endpoint = "/auth/login";
      const response = await api.post(endpoint, credentials);

      if (!response) {
        setError("Login failed. Please try again.");
        return;
      }

      const { user } = response.data || {};
      const role = user?.role;
      const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";

      if (!user || !normalizedRole) {
        setError("Invalid response from server. Please try again.");
        return;
      }

      // Update AuthContext with server-verified user data
      onLoginSuccess(user);

      // Store only non-sensitive display data in localStorage
      localStorage.setItem("fullName", user.fullName || user.full_name || "");
      localStorage.setItem("rollNo", user.rollNo || user.roll_no || "");

      notifySessionChange();

      if (onLogin) {
        onLogin({ role: normalizedRole, user });
      }

      if (normalizedRole === "admin") {
        setTimeout(() => {
          navigate("/admin/dashboard", { replace: true });
        }, 100);
      } else if (normalizedRole === "faculty") {
        navigate("/faculty/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Login error:", err);

      if (err.response) {
        setError(
          err.response.data?.error ||
          err.response.data?.message ||
          "Login failed. Please try again."
        );
      } else if (err.request) {
        setError(
          "Cannot connect to server. Please check if the backend is running."
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 relative overflow-hidden">
      {/* Decorative Elements - Subtle professional gradients */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-slate-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl opacity-30" />

      <div className="max-w-lg w-full relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="w-16 h-16 bg-blue-600 rounded-md mx-auto mb-6 flex items-center justify-center text-white font-bold text-2xl shadow-lg border border-blue-700">
            F
          </div>
          <h1 className="text-3xl font-bold mb-2 text-slate-900 tracking-tight">
            Fullstack Test Portal
          </h1>
          <p className="text-slate-500 font-medium text-base">Advanced Assessment & Evaluation Platform</p>
        </div>

        <div className="bg-white rounded-md shadow-lg border border-slate-200 p-8 md:p-10 animate-fade-in-up delay-100">
          <h2 className="text-xl font-bold text-slate-900 mb-6 uppercase tracking-widest text-[10px]">Security Authentication</h2>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-md">
              <p className="text-rose-600 text-xs font-bold flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-rose-600" />
                {error}
              </p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1">
                Username
              </label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className="input"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1">
                Password
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className="input"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full mt-2 btn-primary h-10"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={18} className="animate-spin" />
                  AUTHENTICATING...
                </span>
              ) : (
                "SIGN IN TO PORTAL"
              )}
            </button>

            {/* Google Sign-In Button */}
            <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col items-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Or sign in with</p>
              <div className="w-full flex justify-center">
                <GoogleLogin
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                  onSuccess={async (credentialResponse) => {
                    try {
                      const googleToken = credentialResponse?.credential;

                      if (!googleToken) {
                        setError(
                          "Unable to read Google credentials. Please try again."
                        );
                        return;
                      }

                      const decoded = jwtDecode(googleToken);

                      // Backend sets HttpOnly cookie automatically
                      const res = await api.post("/auth/google", {
                        token: googleToken,
                      });

                      const { user } = res.data;

                      if (!user) {
                        setError("Invalid Google sign-in response.");
                        return;
                      }

                      // Update AuthContext with server-verified user data
                      onLoginSuccess(user);

                      // Store only non-sensitive display data
                      localStorage.setItem("fullName", user.fullName || user.full_name || "");
                      localStorage.setItem("rollNo", user.rollNo || user.roll_no || "");

                      const normalizedRole =
                        user.role?.toLowerCase?.() || user.role;

                      notifySessionChange();

                      if (onLogin) {
                        onLogin({ role: normalizedRole, user });
                      }

                      if (normalizedRole === "admin") {
                        navigate("/admin/dashboard", { replace: true });
                      } else if (normalizedRole === "faculty") {
                        navigate("/faculty/dashboard");
                      } else {
                        navigate("/");
                      }
                    } catch (err) {
                      console.error("Google Sign-In failed:", err);
                      setError("Google sign-in failed. Try again.");
                    }
                  }}
                  onError={() => setError("Google Sign-In was unsuccessful")}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center animate-fade-in-up delay-200">
          <p className="text-sm font-medium text-slate-500">
            Don't have an account? <span className="text-slate-900 font-bold cursor-pointer hover:underline">Contact System Administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
}
