import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

const AdminAuthContext = createContext(null);

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}

export function AdminRoute({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const storedToken = localStorage.getItem("glazy_admin_token");
      const headers = {};
      if (storedToken) {
        headers["Authorization"] = `Bearer ${storedToken}`;
      }

      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers,
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setAdmin(data.admin);
            setLoading(false);
          }
          return;
        }

        // Invalid session
        localStorage.removeItem("glazy_admin_token");
        localStorage.removeItem("glazy_admin_user");
        if (isMounted) {
          setAdmin(null);
          setLoading(false);
        }
      } catch (err) {
        console.error("Session verification failed:", err);
        localStorage.removeItem("glazy_admin_token");
        localStorage.removeItem("glazy_admin_user");
        if (isMounted) {
          setAdmin(null);
          setLoading(false);
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (_e) {
      // ignore
    }
    localStorage.removeItem("glazy_admin_token");
    localStorage.removeItem("glazy_admin_user");
    setAdmin(null);
    navigate("/admin/login");
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fffaf6",
          color: "#5b2d1c",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ fontSize: "44px", animation: "spin 2s infinite linear", marginBottom: "16px" }}>
          🍩
        </div>
        <h3 style={{ margin: "0 0 8px" }}>Verifying Admin Session...</h3>
        <p style={{ margin: 0, color: "#888", fontSize: "14px" }}>Securing Glazy Days management portal</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <AdminAuthContext.Provider value={{ admin, logout, refreshAdmin: setAdmin }}>
      {React.cloneElement(children, { currentAdmin: admin, onLogout: logout })}
    </AdminAuthContext.Provider>
  );
}
