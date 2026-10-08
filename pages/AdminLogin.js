import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaEye, FaEyeSlash, FaUser, FaLock } from "react-icons/fa";
import logo from "../assets/glazyDayslogo.png";

function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setError("Please enter your username or email.");
      return;
    }
    if (!cleanPass) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        if (data.token) {
          localStorage.setItem("glazy_admin_token", data.token);
        }
        localStorage.setItem("glazy_admin_user", JSON.stringify(data.admin || { username: cleanUser }));
        navigate("/admin/dashboard");
        return;
      }

      setError(data.message || "Invalid credentials.");
    } catch (err) {
      setError("Unable to connect to the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fffaf6",
        padding: "20px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-input:focus {
          border-color: #d96c4a !important;
          box-shadow: 0 0 0 3px rgba(217, 108, 74, 0.2);
        }
        .admin-btn:hover:not(:disabled) {
          background: #c25939 !important;
        }
        .admin-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .back-link:hover {
          text-decoration: underline !important;
        }
        @media (max-width: 480px) {
          .admin-login-card {
            padding: 28px 18px !important;
            border-radius: 14px !important;
          }
        }
      `}</style>
      <div
        className="admin-login-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 10px 30px rgba(80, 40, 20, 0.1)",
          border: "1px solid #f8d9d1",
          padding: "40px 32px",
          textAlign: "center",
          animation: "fadeUp 0.5s ease-out forwards",
          position: "relative",
          zIndex: 10
        }}
      >
        <img src={logo} alt="Glazy Days Logo" style={{ width: "80px", marginBottom: "16px" }} />
        <h2 style={{ margin: "0 0 8px", color: "#5b2d1c", fontSize: "24px" }}>
          Admin Portal
        </h2>
        <p style={{ color: "#7a5246", marginBottom: "32px", fontSize: "14px" }}>
          Manage your Glazy Days donut shop
        </p>

        <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "#5c3a2d", fontSize: "14px", fontWeight: "bold" }}>
              Username or Email
            </label>
            <div style={{ position: "relative" }}>
              <FaUser style={{ position: "absolute", left: "12px", top: "14px", color: "#d96c4a" }} />
              <input
                className="admin-input"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="Enter your email or username"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 12px 12px 40px",
                  borderRadius: "10px",
                  border: "1px solid #f0c8bf",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "all 0.2s"
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label style={{ display: "block", marginBottom: "8px", color: "#5c3a2d", fontSize: "14px", fontWeight: "bold" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <FaLock style={{ position: "absolute", left: "12px", top: "14px", color: "#d96c4a" }} />
              <input
                className="admin-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Enter your password"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "12px 40px 12px 40px",
                  borderRadius: "10px",
                  border: "1px solid #f0c8bf",
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "all 0.2s"
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "12px",
                  background: "none",
                  border: "none",
                  color: "#d96c4a",
                  cursor: "pointer",
                  padding: "0"
                }}
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: "#fdf2f2", color: "#b42318", padding: "10px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", textAlign: "left", border: "1px solid #f8d0d0", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>⚠</span> {error}
            </div>
          )}

          <button
            className="admin-btn"
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "#f0c8bf" : "#d96c4a",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "14px 16px",
              fontWeight: 700,
              fontSize: "16px",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 4px 12px rgba(217, 108, 74, 0.3)"
            }}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        <div style={{ marginTop: "24px" }}>
          <Link to="/" className="back-link" style={{ color: "#d96c4a", textDecoration: "none", fontSize: "14px", fontWeight: "bold" }}>
            ← Back to Store
          </Link>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
