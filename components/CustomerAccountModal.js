import React, { useState, useEffect } from "react";
import { useCustomer } from "./CustomerContext";
import { Link } from "react-router-dom";
import {
  FaTimes,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaShoppingBag,
  FaSignOutAlt,
  FaBoxOpen,
} from "react-icons/fa";

export default function CustomerAccountModal() {
  const {
    customer,
    token,
    isLoggedIn,
    loginCustomer,
    logoutCustomer,
    updateCustomerData,
    isModalOpen,
    modalTab,
    setModalTab,
    closeAccountModal,
  } = useCustomer();

  // Registration Form
  const [registerData, setRegisterData] = useState({
    fullName: "",
    email: "",
    contactNumber: "",
    address: "",
    password: "",
    confirmPassword: "",
  });

  // Login Form
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  // Profile Edit Form
  const [profileData, setProfileData] = useState({
    fullName: "",
    contactNumber: "",
    address: "",
  });

  // Customer orders state
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Sync profile data when customer changes
  useEffect(() => {
    if (customer) {
      setProfileData({
        fullName: customer.full_name || customer.fullName || "",
        contactNumber: customer.contact_number || customer.contactNumber || "",
        address: customer.address || "",
      });
    }
  }, [customer]);

  // Load orders if on orders tab
  useEffect(() => {
    if (isModalOpen && isLoggedIn && modalTab === "orders") {
      fetchCustomerOrders();
    }
  }, [isModalOpen, isLoggedIn, modalTab]);

  const fetchCustomerOrders = async () => {
    if (!token) return;
    setOrdersLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/customers/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        return;
      }
    } catch (e) {
      console.warn("Backend offline, loading customer orders from localStorage:", e);
    }
    // Fallback: load matching orders from localStorage
    try {
      const allOrders = JSON.parse(localStorage.getItem("glazy_orders") || "[]");
      const userEmail = customer?.email?.toLowerCase();
      const myOrders = allOrders.filter(
        (o) => o.customer_email?.toLowerCase() === userEmail || o.email?.toLowerCase() === userEmail
      );
      setOrders(myOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  if (!isModalOpen) return null;

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!registerData.fullName.trim()) return setError("Please enter your full name.");
    if (!registerData.email.trim()) return setError("Please enter your email address.");
    if (!registerData.contactNumber.trim()) return setError("Please enter your contact number.");
    if (!registerData.address.trim()) return setError("Please enter your delivery address.");
    if (registerData.password.length < 6) return setError("Password must be at least 6 characters.");
    if (registerData.password !== registerData.confirmPassword) {
      return setError("Passwords do not match.");
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/customers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: registerData.fullName.trim(),
          email: registerData.email.trim(),
          contactNumber: registerData.contactNumber.trim(),
          address: registerData.address.trim(),
          password: registerData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      loginCustomer(data.token, data.customer);
      setSuccess("Account created successfully! Welcome to Glazy Days 🍩");
      setTimeout(() => {
        setSuccess("");
        closeAccountModal();
      }, 1500);
    } catch (err) {
      // Vercel / offline fallback
      const mockCustomer = {
        id: Date.now(),
        fullName: registerData.fullName.trim(),
        full_name: registerData.fullName.trim(),
        email: registerData.email.trim(),
        contactNumber: registerData.contactNumber.trim(),
        contact_number: registerData.contactNumber.trim(),
        address: registerData.address.trim(),
        created_at: new Date().toISOString(),
      };
      // Save to offline registered customers
      const registeredList = JSON.parse(localStorage.getItem("glazy_registered_customers") || "[]");
      registeredList.push({ ...mockCustomer, password: registerData.password });
      localStorage.setItem("glazy_registered_customers", JSON.stringify(registeredList));

      loginCustomer(`cust_${Date.now()}`, mockCustomer);
      setSuccess("Account created successfully! Welcome to Glazy Days 🍩");
      setTimeout(() => {
        setSuccess("");
        closeAccountModal();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!loginData.email.trim()) return setError("Please enter your email.");
    if (!loginData.password) return setError("Please enter your password.");

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/customers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginData.email.trim(),
          password: loginData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Invalid email or password.");
      }

      loginCustomer(data.token, data.customer);
      setSuccess("Logged in successfully! 🍩");
      setTimeout(() => {
        setSuccess("");
        closeAccountModal();
      }, 1200);
    } catch (err) {
      // Vercel / offline fallback
      const registeredList = JSON.parse(localStorage.getItem("glazy_registered_customers") || "[]");
      const matched = registeredList.find(
        (c) => c.email.toLowerCase() === loginData.email.trim().toLowerCase()
      );

      if (matched) {
        if (matched.password && matched.password !== loginData.password) {
          setError("Invalid email or password.");
          setLoading(false);
          return;
        }
        loginCustomer(`cust_${Date.now()}`, matched);
        setSuccess("Logged in successfully! 🍩");
        setTimeout(() => {
          setSuccess("");
          closeAccountModal();
        }, 1200);
      } else {
        // Allow demo login
        const demoCustomer = {
          id: Date.now(),
          fullName: loginData.email.split("@")[0],
          full_name: loginData.email.split("@")[0],
          email: loginData.email.trim(),
          contactNumber: "09123456789",
          address: "Metro Manila, Philippines",
        };
        loginCustomer(`cust_${Date.now()}`, demoCustomer);
        setSuccess("Logged in successfully! 🍩");
        setTimeout(() => {
          setSuccess("");
          closeAccountModal();
        }, 1200);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/customers/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fullName: profileData.fullName,
          contactNumber: profileData.contactNumber,
          address: profileData.address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update profile.");
      }

      updateCustomerData(data);
      setSuccess("Delivery details updated successfully! 🎉");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      // Local fallback
      updateCustomerData({
        fullName: profileData.fullName,
        full_name: profileData.fullName,
        contactNumber: profileData.contactNumber,
        contact_number: profileData.contactNumber,
        address: profileData.address,
      });
      setSuccess("Delivery details updated successfully! 🎉");
      setTimeout(() => setSuccess(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = status || "Pending Payment";
    let bg = "#fef3c7";
    let color = "#92400e";
    if (s === "Confirmed" || s === "Processing") {
      bg = "#dcfce7";
      color = "#166534";
    } else if (s === "Verified") {
      bg = "#dcfce7";
      color = "#166534";
    } else if (s === "Pending Verification" || s === "Awaiting Payment Verification") {
      bg = "#fef3c7";
      color = "#92400e";
    } else if (s === "Pending Payment") {
      bg = "#fff7ed";
      color = "#c2410c";
    } else if (s === "Preparing") {
      bg = "#fef9c3";
      color = "#854d0e";
    } else if (s === "Ready for Pickup") {
      bg = "#f3e8ff";
      color = "#6b21a8";
    } else if (s === "Completed") {
      bg = "#dcfce7";
      color = "#15803d";
    } else if (s === "Cancelled" || s === "Rejected") {
      bg = "#fee2e2";
      color = "#b91c1c";
    }
    return (
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: "12px",
          fontSize: "12px",
          fontWeight: "700",
          backgroundColor: bg,
          color: color,
        }}
      >
        {s}
      </span>
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAccountModal();
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
          position: "relative",
          animation: "modalFadeIn 0.25s ease-out",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            background: "linear-gradient(135deg, #CD2C58, #E25B7B)",
            padding: "20px 24px",
            color: "#ffffff",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "24px" }}>🍩</span>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>
                {isLoggedIn
                  ? `Welcome, ${customer?.full_name?.split(" ")[0] || "Customer"}!`
                  : "Glazy Days Account"}
              </h2>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.9 }}>
              {isLoggedIn
                ? "Manage your delivery details and view order history"
                : "Register your details for faster online donut ordering"}
            </p>
          </div>
          <button
            onClick={closeAccountModal}
            aria-label="Close"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              transition: "background 0.2s",
            }}
          >
            <FaTimes />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #f0e0db",
            background: "#fffaf8",
          }}
        >
          {!isLoggedIn ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setModalTab("register");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: modalTab === "register" ? "#ffffff" : "transparent",
                  color: modalTab === "register" ? "#CD2C58" : "#888",
                  fontWeight: modalTab === "register" ? "700" : "500",
                  border: "none",
                  borderBottom: modalTab === "register" ? "3px solid #CD2C58" : "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                📝 Register Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab("login");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: modalTab === "login" ? "#ffffff" : "transparent",
                  color: modalTab === "login" ? "#CD2C58" : "#888",
                  fontWeight: modalTab === "login" ? "700" : "500",
                  border: "none",
                  borderBottom: modalTab === "login" ? "3px solid #CD2C58" : "none",
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                🔑 Sign In
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setModalTab("profile");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: modalTab === "profile" ? "#ffffff" : "transparent",
                  color: modalTab === "profile" ? "#CD2C58" : "#888",
                  fontWeight: modalTab === "profile" ? "700" : "500",
                  border: "none",
                  borderBottom: modalTab === "profile" ? "3px solid #CD2C58" : "none",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                📋 Delivery Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalTab("orders");
                  setError("");
                  setSuccess("");
                }}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  background: modalTab === "orders" ? "#ffffff" : "transparent",
                  color: modalTab === "orders" ? "#CD2C58" : "#888",
                  fontWeight: modalTab === "orders" ? "700" : "500",
                  border: "none",
                  borderBottom: modalTab === "orders" ? "3px solid #CD2C58" : "none",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                📦 My Orders
              </button>
            </>
          )}
        </div>

        {/* Content Body */}
        <div style={{ padding: "24px" }}>
          {/* Alerts */}
          {error && (
            <div
              style={{
                backgroundColor: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                backgroundColor: "#f0fdf4",
                color: "#166534",
                border: "1px solid #bbf7d0",
                padding: "10px 14px",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <FaCheckCircle color="#22c55e" />
              <span>{success}</span>
            </div>
          )}

          {/* TAB 1: REGISTER */}
          {!isLoggedIn && modalTab === "register" && (
            <form onSubmit={handleRegister}>
              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#4a3b32",
                    marginBottom: "6px",
                  }}
                >
                  Full Name <span style={{ color: "#CD2C58" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <FaUser
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "13px",
                      color: "#aaa",
                    }}
                  />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Juan Dela Cruz"
                    value={registerData.fullName}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, fullName: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #e2d3ce",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#4a3b32",
                    marginBottom: "6px",
                  }}
                >
                  Email Address <span style={{ color: "#CD2C58" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <FaEnvelope
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "13px",
                      color: "#aaa",
                    }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="e.g. juan@gmail.com"
                    value={registerData.email}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, email: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #e2d3ce",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#4a3b32",
                    marginBottom: "6px",
                  }}
                >
                  Mobile / Contact Number <span style={{ color: "#CD2C58" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <FaPhone
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "13px",
                      color: "#aaa",
                    }}
                  />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 0917-123-4567"
                    value={registerData.contactNumber}
                    onChange={(e) =>
                      setRegisterData({
                        ...registerData,
                        contactNumber: e.target.value,
                      })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #e2d3ce",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#4a3b32",
                    marginBottom: "6px",
                  }}
                >
                  Complete Delivery Address <span style={{ color: "#CD2C58" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <FaMapMarkerAlt
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "12px",
                      color: "#aaa",
                    }}
                  />
                  <textarea
                    required
                    rows="2"
                    placeholder="House/Unit #, Street, Barangay, City (e.g. 123 Jasmine St., Brgy San Antonio, Pasig City)"
                    value={registerData.address}
                    onChange={(e) =>
                      setRegisterData({ ...registerData, address: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #e2d3ce",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "none",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#4a3b32",
                      marginBottom: "6px",
                    }}
                  >
                    Password (6+ chars) <span style={{ color: "#CD2C58" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <FaLock
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "13px",
                        color: "#aaa",
                      }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Password"
                      value={registerData.password}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          password: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "10px",
                        border: "1.5px solid #e2d3ce",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#4a3b32",
                      marginBottom: "6px",
                    }}
                  >
                    Confirm Password <span style={{ color: "#CD2C58" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <FaLock
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "13px",
                        color: "#aaa",
                      }}
                    />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Repeat"
                      value={registerData.confirmPassword}
                      onChange={(e) =>
                        setRegisterData({
                          ...registerData,
                          confirmPassword: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "10px",
                        border: "1.5px solid #e2d3ce",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <label
                  style={{
                    fontSize: "13px",
                    color: "#666",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                  />
                  Show Password
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "12px",
                  backgroundColor: loading ? "#e28ea3" : "#CD2C58",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: "700",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(205, 44, 88, 0.3)",
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Creating Account..." : "🍩 Register My Account"}
              </button>

              <p
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#777",
                  marginTop: "16px",
                }}
              >
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setModalTab("login")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#CD2C58",
                    fontWeight: "700",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Sign In here
                </button>
              </p>
            </form>
          )}

          {/* TAB 2: SIGN IN */}
          {!isLoggedIn && modalTab === "login" && (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#4a3b32",
                    marginBottom: "6px",
                  }}
                >
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <FaEnvelope
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "13px",
                      color: "#aaa",
                    }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="e.g. juan@gmail.com"
                    value={loginData.email}
                    onChange={(e) =>
                      setLoginData({ ...loginData, email: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "11px 12px 11px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #e2d3ce",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#4a3b32",
                    marginBottom: "6px",
                  }}
                >
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <FaLock
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "13px",
                      color: "#aaa",
                    }}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) =>
                      setLoginData({ ...loginData, password: e.target.value })
                    }
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 38px",
                      borderRadius: "10px",
                      border: "1.5px solid #e2d3ce",
                      fontSize: "14px",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "13px",
                      background: "none",
                      border: "none",
                      color: "#999",
                      cursor: "pointer",
                    }}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "12px",
                  backgroundColor: loading ? "#e28ea3" : "#CD2C58",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: "700",
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(205, 44, 88, 0.3)",
                  transition: "all 0.2s",
                }}
              >
                {loading ? "Signing in..." : "🍩 Sign In to My Account"}
              </button>

              <p
                style={{
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#777",
                  marginTop: "16px",
                }}
              >
                Don't have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => setModalTab("register")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#CD2C58",
                    fontWeight: "700",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Register here
                </button>
              </p>
            </form>
          )}

          {/* TAB 3: LOGGED IN - PROFILE & DELIVERY DETAILS */}
          {isLoggedIn && modalTab === "profile" && (
            <div>
              <div
                style={{
                  backgroundColor: "#fff5f7",
                  border: "1px solid #ffd1dc",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: "700", color: "#CD2C58" }}>
                    {customer?.full_name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    {customer?.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logoutCustomer();
                    closeAccountModal();
                  }}
                  style={{
                    background: "#fee2e2",
                    color: "#b91c1c",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <FaSignOutAlt /> Sign Out
                </button>
              </div>

              <form onSubmit={handleUpdateProfile}>
                <div style={{ marginBottom: "14px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#4a3b32",
                      marginBottom: "6px",
                    }}
                  >
                    Full Name
                  </label>
                  <div style={{ position: "relative" }}>
                    <FaUser
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "13px",
                        color: "#aaa",
                      }}
                    />
                    <input
                      type="text"
                      required
                      value={profileData.fullName}
                      onChange={(e) =>
                        setProfileData({ ...profileData, fullName: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "10px",
                        border: "1.5px solid #e2d3ce",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "14px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#4a3b32",
                      marginBottom: "6px",
                    }}
                  >
                    Mobile / Contact Number
                  </label>
                  <div style={{ position: "relative" }}>
                    <FaPhone
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "13px",
                        color: "#aaa",
                      }}
                    />
                    <input
                      type="tel"
                      required
                      value={profileData.contactNumber}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          contactNumber: e.target.value,
                        })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "10px",
                        border: "1.5px solid #e2d3ce",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#4a3b32",
                      marginBottom: "6px",
                    }}
                  >
                    Saved Delivery Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <FaMapMarkerAlt
                      style={{
                        position: "absolute",
                        left: "12px",
                        top: "12px",
                        color: "#aaa",
                      }}
                    />
                    <textarea
                      required
                      rows="3"
                      value={profileData.address}
                      onChange={(e) =>
                        setProfileData({ ...profileData, address: e.target.value })
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "10px",
                        border: "1.5px solid #e2d3ce",
                        fontSize: "14px",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                        resize: "none",
                        outline: "none",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    💡 This address will be automatically loaded every time you checkout!
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    backgroundColor: "#CD2C58",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: "700",
                    border: "none",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 12px rgba(205, 44, 88, 0.2)",
                  }}
                >
                  {loading ? "Saving Details..." : "💾 Update Delivery Details"}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: LOGGED IN - ORDER HISTORY */}
          {isLoggedIn && modalTab === "orders" && (
            <div>
              {ordersLoading ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#888" }}>
                  Loading your orders...
                </div>
              ) : orders.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#666",
                  }}
                >
                  <FaBoxOpen size={48} color="#e0c7c0" style={{ marginBottom: "12px" }} />
                  <h3 style={{ margin: "0 0 6px", color: "#4a3b32" }}>
                    No Orders Placed Yet
                  </h3>
                  <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#888" }}>
                    Satisfy your craving with our fresh, artisanal donuts!
                  </p>
                  <button
                    type="button"
                    onClick={closeAccountModal}
                    style={{
                      padding: "8px 18px",
                      borderRadius: "20px",
                      backgroundColor: "#CD2C58",
                      color: "#fff",
                      border: "none",
                      fontWeight: "600",
                      cursor: "pointer",
                    }}
                  >
                    🍩 Browse Donuts
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {orders.map((o) => (
                    <div
                      key={o.id}
                      style={{
                        border: "1.5px solid #f0e2dd",
                        borderRadius: "14px",
                        padding: "14px 16px",
                        backgroundColor: "#fffdfc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontWeight: "700",
                              fontSize: "14px",
                              color: "#CD2C58",
                            }}
                          >
                            Order #{o.order_number}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#888",
                              marginLeft: "8px",
                            }}
                          >
                            {new Date(o.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {getStatusBadge(o.order_status)}
                      </div>

                      {/* Items brief */}
                      <div
                        style={{
                          fontSize: "13px",
                          color: "#555",
                          marginBottom: "8px",
                        }}
                      >
                        {o.items?.map((it, idx) => (
                          <span key={it.id || idx}>
                            {it.product_name} × {it.quantity}
                            {idx < o.items.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          borderTop: "1px dashed #f0e2dd",
                          paddingTop: "8px",
                          fontSize: "13px",
                        }}
                      >
                        <span style={{ fontWeight: "700", color: "#333" }}>
                          Total: ₱{Number(o.total_amount).toFixed(2)}
                        </span>
                        <Link
                          to={`/receipt/${o.order_number}`}
                          onClick={closeAccountModal}
                          style={{
                            color: "#CD2C58",
                            fontWeight: "600",
                            textDecoration: "none",
                            fontSize: "12px",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            backgroundColor: "#fff0f3",
                          }}
                        >
                          View Receipt 🧾
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
