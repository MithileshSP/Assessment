import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { clearAdminSession, notifySessionChange } from "../utils/session";
import api from "../services/api";

export default function Login({ isAdmin = false, onLogin }) {
  const navigate = useNavigate();
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
      const endpoint = "/auth/login";



      const response = await api.post(endpoint, credentials);

      if (!response) {
        setError("Login failed. Please try again.");
        return;
      }

      const { user, token } = response.data || {};
      const role = user?.role;
      const normalizedRole = typeof role === "string" ? role.toLowerCase() : "";



      if (!user || !token || !normalizedRole) {
        setError("Invalid response from server. Please try again.");
        return;
      }

      localStorage.setItem("userRole", normalizedRole);

      if (normalizedRole === "admin") {
        localStorage.setItem("adminToken", token);
        localStorage.setItem("adminUser", JSON.stringify(user));
        localStorage.setItem("userToken", token);
        localStorage.setItem("userId", user.id);
        localStorage.setItem("username", user.username);
        notifySessionChange();



        if (onLogin) {
          onLogin({ role: normalizedRole, user, token });
        }

        setTimeout(() => {
          navigate("/admin/dashboard", { replace: true });
        }, 100);
        return;
      }

      clearAdminSession();
      localStorage.setItem("userId", user.id);
      localStorage.setItem("username", user.username);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("fullName", user.fullName || user.full_name);
      localStorage.setItem("userToken", token);
      notifySessionChange();

      navigate("/");
    } catch (err) {
      console.error("Login error:", err);
      console.error("Error response:", err.response);

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
      {/* Decorative Elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-100/50 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-200/30 rounded-full blur-3xl" />

      <div className="max-w-lg w-full relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="w-20 h-20 bg-primary-600 rounded-3xl mx-auto mb-6 flex items-center justify-center text-white font-display font-black text-3xl shadow-xl shadow-primary-600/20 rotate-3">
            P
          </div>
          <h1 className="text-4xl font-display font-bold mb-3 text-slate-900 tracking-tight">
            Portal Assessment
          </h1>
          <p className="text-slate-500 font-medium text-lg">Sign in to continue your professional journey</p>
        </div>

        <div className="card shadow-premium-hover p-10 animate-fade-in-up delay-100">
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-8">Authentication</h2>

          {error && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl animate-pulse">
              <p className="text-rose-600 text-sm font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
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
              className="w-full mt-4 btn-primary h-14"
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
            <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Or continue with</p>
              <div className="w-full flex justify-center scale-110">
                <GoogleLogin
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="pill"
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


                      const res = await api.post("/auth/google", {
                        token: googleToken,
                      });

                      const { user, token } = res.data;

                      if (!user || !token) {
                        setError("Invalid Google sign-in response.");
                        return;
                      }

                      // Save to localStorage
                      localStorage.setItem("userToken", token);
                      localStorage.setItem("username", user.username);
                      localStorage.setItem("userId", user.id);
                      localStorage.setItem("userRole", user.role);
                      localStorage.setItem("user", JSON.stringify(user));
                      localStorage.setItem("fullName", user.fullName || user.full_name);


                      const normalizedRole =
                        user.role?.toLowerCase?.() || user.role;

                      if (normalizedRole === "admin") {
                        localStorage.setItem("adminToken", token);
                        localStorage.setItem("adminUser", JSON.stringify(user));
                        notifySessionChange();
                        if (onLogin) {
                          onLogin({ role: normalizedRole, user, token });
                        }
                        navigate("/admin/dashboard", { replace: true });
                      } else {
                        clearAdminSession();
                        if (onLogin) {
                          onLogin({ role: normalizedRole, user, token });
                        }
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
            Don't have an account? <span className="text-primary-600 font-bold cursor-pointer hover:underline">Contact Administrator</span>
          </p>
        </div>
      </div>
    </div>
  );
}
