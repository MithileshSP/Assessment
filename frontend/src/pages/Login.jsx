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
      localStorage.setItem("userToken", token);


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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900">
            Frontend Test Portal
          </h1>
          <p className="text-gray-600">Sign in to continue learning</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all outline-none focus:ring-indigo-500"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent transition-all outline-none focus:ring-indigo-500"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {/* Google Sign-In Button */}
            <div className="mt-6 flex justify-center">
              <GoogleLogin
                theme="outline"
                size="large"
                text="signin_with"
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

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  );
}
