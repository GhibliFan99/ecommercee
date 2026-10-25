import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { donuts, getDonutImage } from "../data/donuts";
import "../styles/App.css";

function badge(text, bg, color) {
  return (
    <span style={{ background: bg, color, padding: "3px 10px", borderRadius: "12px", fontWeight: 700, fontSize: "12px", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}
function paymentBadge(status) {
  if (status === "Verified") return badge(status, "#dcfce7", "#166534");
  if (status === "Rejected") return badge(status, "#fee2e2", "#dc2626");
  return badge(status || "Pending Verification", "#fef3c7", "#92400e");
}
function orderStatusBadge(status) {
  const s = status || "Pending";
  if (["Confirmed","Processing","Preparing","Ready for Pickup","Completed"].includes(s)) return badge(s, "#dcfce7", "#166534");
  if (["Pending Payment","Awaiting Payment Verification"].includes(s)) return badge(s, "#fef3c7", "#92400e");
  if (s === "Cancelled") return badge(s, "#fee2e2", "#dc2626");
  return badge(s, "#f3f4f6", "#374151");
}

// ── SVG Best Seller Bar Chart ─────────────────────────────────────────────────
function BestSellerBarChart({ data = [], tall = false }) {
  const chartH = tall ? 260 : 180;
  const padding = { top: 22, right: 16, bottom: 65, left: 44 };
  const svgW = 520;
  const svgH = chartH + padding.top + padding.bottom;
  const plotW = svgW - padding.left - padding.right;
  const plotH = chartH;

  const maxUnits = Math.max(...data.map(d => d.unitsSold), 1);
  const barColors = ["#d96c4a","#e8957a","#f0b8a2","#f5cfc0","#f9e4dc","#fdf1ee"];

  // Ensure bars always have an elegant, proportioned width (never bloated or stretched)
  const slots = Math.max(data.length, 6);
  const slotW = plotW / slots;
  const barW = Math.min(36, slotW * 0.65);

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
      {/* Y-axis gridlines */}
      {[0,0.25,0.5,0.75,1].map(t => {
        const y = padding.top + plotH * (1 - t);
        const val = Math.round(maxUnits * t);
        return (
          <g key={t}>
            <line x1={padding.left} y1={y} x2={padding.left + plotW} y2={y}
              stroke="#f0c8bf" strokeWidth="1" strokeDasharray={t===0?"":"4 3"} />
            <text x={padding.left - 6} y={y + 4} textAnchor="end" fill="#b08880" fontSize="10">{val}</text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const x = padding.left + i * slotW + (slotW - barW) / 2;
        const barH = d.unitsSold > 0 ? Math.max(4, (d.unitsSold / maxUnits) * plotH) : 2;
        const y = padding.top + plotH - barH;
        const color = d.unitsSold > 0 ? barColors[i % barColors.length] : "#edd6ce";
        return (
          <g key={d.productId || i}>
            <rect x={x} y={y} width={barW} height={barH} rx="5" fill={color} opacity="0.95" />
            {/* Value label */}
            <text
              x={x + barW/2}
              y={d.unitsSold > 0 ? y - 6 : y - 4}
              textAnchor="middle"
              fill={d.unitsSold > 0 ? (i === 0 ? "#d96c4a" : "#b08880") : "#c7a9a0"}
              fontSize="11"
              fontWeight="800"
            >
              {d.unitsSold}
            </text>
            {/* Product name — rotated */}
            <text
              x={x + barW/2}
              y={padding.top + plotH + 12}
              textAnchor="end"
              fill={d.unitsSold > 0 ? "#5b2d1c" : "#a88a80"}
              fontSize="10"
              fontWeight={d.unitsSold > 0 ? 700 : 500}
              transform={`rotate(-35,${x + barW/2},${padding.top + plotH + 12})`}
            >
              {d.productName.length > 12 ? d.productName.slice(0,12)+"…" : d.productName}
            </text>
          </g>
        );
      })}
      {/* Y-axis */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top+plotH} stroke="#f0c8bf" strokeWidth="1.5" />
    </svg>
  );
}

// ── SVG Sales Rate Area Chart ─────────────────────────────────────────────────
function SalesRateAreaChart({ data = [] }) {
  const padding = { top: 16, right: 10, bottom: 44, left: 54 };
  const svgW = 520;
  const chartH = 180;
  const svgH = chartH + padding.top + padding.bottom;
  const plotW = svgW - padding.left - padding.right;
  const plotH = chartH;

  const maxRev = Math.max(...data.map(d => Number(d.revenue || 0)), 1);

  const pts = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * plotW;
    const y = padding.top + plotH - (Number(d.revenue) / maxRev) * plotH;
    return { x, y, d };
  });

  const pathD = pts.map((p, i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${(padding.left + plotW).toFixed(1)},${(padding.top+plotH).toFixed(1)} L${padding.left.toFixed(1)},${(padding.top+plotH).toFixed(1)} Z`;

  const fmtMonth = (ym) => {
    if (!ym) return "";
    const [y, m] = ym.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[(Number(m)-1)%12]}`;
  };

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width:"100%", height:"auto", overflow:"visible" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d96c4a" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#d96c4a" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* Gridlines */}
      {[0,0.25,0.5,0.75,1].map(t => {
        const y = padding.top + plotH * (1 - t);
        const val = (maxRev * t).toFixed(0);
        return (
          <g key={t}>
            <line x1={padding.left} y1={y} x2={padding.left+plotW} y2={y} stroke="#f0c8bf" strokeWidth="1" strokeDasharray={t===0?"":"4 3"} />
            <text x={padding.left-6} y={y+4} textAnchor="end" fill="#b08880" fontSize="9">₱{Number(val).toLocaleString()}</text>
          </g>
        );
      })}
      {/* Area fill */}
      {pts.length > 1 && <path d={areaD} fill="url(#areaGrad)" />}
      {/* Line */}
      {pts.length > 1 && <path d={pathD} fill="none" stroke="#d96c4a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {/* Dots */}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="#d96c4a" strokeWidth="2" />
      ))}
      {/* X-axis labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={padding.top+plotH+14} textAnchor="middle" fill="#9a7060" fontSize="9">{fmtMonth(p.d.month)}</text>
      ))}
      {/* Y-axis */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top+plotH} stroke="#f0c8bf" strokeWidth="1.5" />
    </svg>
  );
}

function AdminDashboard({ currentAdmin: propAdmin, onLogout }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [toast, setToast] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name:"", description:"", price:"", image:"", stock_quantity:"", availability:true });

  // Inline confirm modal (replaces window.confirm)
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm, promptLabel }
  const [confirmInput, setConfirmInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Best Seller Chart & Sales Rate state
  const [bestSellers, setBestSellers] = useState([]);
  const [bestSellerPeriod, setBestSellerPeriod] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [salesRate, setSalesRate] = useState([]);
  const [lastCallData, setLastCallData] = useState(null);
  const [lastCallSettings, setLastCallSettings] = useState(null);
  const [savingLCSettings, setSavingLCSettings] = useState(false);
  const [lcSettingsForm, setLcSettingsForm] = useState(null);
  const bestSellerBarRef = useRef(null);
  const salesRateRef = useRef(null);

  // Ready / Unclaimed orders and Claim QR verification
  const [claimModal, setClaimModal] = useState(null); // { order } or true
  const [claimInput, setClaimInput] = useState("");
  const [claimError, setClaimError] = useState("");
  const [nowTime, setNowTime] = useState(Date.now());

  // Admin password change modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const token = localStorage.getItem("glazy_admin_token");
  const currentAdmin = propAdmin || JSON.parse(localStorage.getItem("glazy_admin_user") || "null") || { username: "Admin", role: "owner" };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const fetchBestSellers = useCallback(async (period = "month", customStart = null, customEnd = null) => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      let url = `/api/reports/best-sellers?period=${period}&limit=8`;
      if (period === "custom") {
        if (customStart) url += `&startDate=${encodeURIComponent(customStart)}`;
        if (customEnd) url += `&endDate=${encodeURIComponent(customEnd)}`;
      }
      const res = await fetch(url, { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBestSellers(data.bestSellers || []);
      }
    } catch (err) {
      console.error("Best sellers fetch error:", err);
    }
  }, [token]);

  const fetchSalesRate = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("/api/reports/sales-rate", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSalesRate(data.salesRate || []);
      }
    } catch (err) {
      console.error("Sales rate fetch error:", err);
    }
  }, [token]);

  const fetchLastCallData = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [dealsRes, settingsRes] = await Promise.all([
        fetch("/api/deals/last-call", { headers, credentials: "include" }),
        fetch("/api/deals/last-call/settings", { headers, credentials: "include" }),
      ]);
      if (dealsRes.ok) {
        const data = await dealsRes.json();
        setLastCallData(data);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setLastCallSettings(data.settings);
        setLcSettingsForm(data.settings);
      }
    } catch (err) {
      console.error("Last call fetch error:", err);
    }
  }, [token]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setIsRefreshing(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [productsRes, ordersRes, customersRes, paymentsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/orders", { headers, credentials: "include" }),
        fetch("/api/admin/customers", { headers, credentials: "include" }),
        fetch("/api/payments", { headers, credentials: "include" }),
      ]);

      if (productsRes.ok) {
        const prodData = await productsRes.json();
        setProducts(prodData);
      }
      if (ordersRes.ok) {
        const ordData = await ordersRes.json();
        setOrders(ordData);
      }
      if (customersRes.ok) {
        const custData = await customersRes.json();
        setCustomers(custData);
      }
      if (paymentsRes.ok) {
        const pmtData = await paymentsRes.json();
        setPayments(pmtData);
      }
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Dashboard live fetch error:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    fetchBestSellers("month");
    fetchSalesRate();
    fetchLastCallData();
    // 15-second background polling to catch new storefront orders automatically
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);
    const ticker = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(ticker);
    };
  }, [fetchData, fetchBestSellers, fetchSalesRate, fetchLastCallData]);

  useEffect(() => {
    if (bestSellerPeriod === "custom") {
      if (customStartDate && customEndDate) {
        fetchBestSellers("custom", customStartDate, customEndDate);
      }
    } else {
      fetchBestSellers(bestSellerPeriod);
    }
  }, [bestSellerPeriod, customStartDate, customEndDate, fetchBestSellers]);

  const totalSales = orders.filter(o => o.payment_status === "Verified" || o.order_status === "Confirmed" || o.order_status === "Completed").reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const pendingCount = payments.filter(p => p.status === "Pending Verification").length;
  const verifiedCount = payments.filter(p => p.status === "Verified").length;
  const completedCount = orders.filter(o => o.order_status === "Completed").length;
  const cancelledCount = orders.filter(o => o.order_status === "Cancelled").length;
  const lowStockCount = products.filter(p => Number(p.stock_quantity ?? 0) <= 5).length;
  const unclaimedOrders = orders.filter(o => o.order_status === "Ready for Pickup");

  const handleVerifyPayment = (paymentOrOrderId, action) => {
    const isVerify = action === "verify";
    setConfirmInput("");
    setConfirmModal({
      title: isVerify ? "✅ Verify Payment" : "❌ Reject Payment",
      message: isVerify
        ? "Are you sure you want to verify this payment? The order will be marked as Confirmed."
        : "Are you sure you want to reject this payment?",
      promptLabel: !isVerify ? "Rejection reason (optional):" : null,
      confirmLabel: isVerify ? "Yes, Verify" : "Yes, Reject",
      confirmColor: isVerify ? "#166534" : "#dc2626",
      confirmBg: isVerify ? "#dcfce7" : "#fee2e2",
      onConfirm: async (inputValue) => {
        setActionLoading(true);
        try {
          const res = await fetch(`/api/payments/${paymentOrOrderId}/verify`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            credentials: "include",
            body: JSON.stringify({ action, admin_notes: inputValue || undefined }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.message || "Failed to process payment verification.");
          }
          showToast(data.message || (isVerify ? "✅ Payment Verified! Order Confirmed." : "❌ Payment Rejected"));
          setConfirmModal(null);
          await fetchData(true);
        } catch (err) {
          showToast(err.message || "Payment verification failed.");
          setConfirmModal(null);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleCallNumber = async (orderId, queueNumber) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to call number.");
      }
      showToast(`📢 Called Queue ${queueNumber || 'number'}! Store board updated.`);
      await fetchData(true);
    } catch (err) {
      showToast(err.message || "Could not call queue number.");
    }
  };

  const handleVerifyClaim = async ({ orderNumber, trackingToken, qrData }) => {
    setClaimError("");
    setActionLoading(true);
    try {
      const res = await fetch("/api/orders/claim-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ orderNumber, trackingToken, qrData }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Claim verification failed.");
      }
      showToast(`✅ ${data.message}`);
      setClaimModal(null);
      setClaimInput("");
      await fetchData(true);
    } catch (err) {
      setClaimError(err.message || "Claim verification failed.");
      showToast(err.message || "Claim verification failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (id, newStatus, currentOrder) => {
    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ order_status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update order status.");
      }
      if (newStatus === "Ready for Pickup") {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        showToast(`🔔 ${currentOrder?.queue_number || 'Order'} marked Ready! Notified at ${timeStr}`);
      } else {
        showToast(`Order status updated to ${newStatus}`);
      }
      await fetchData(true);
    } catch (err) {
      showToast(err.message || "Failed to update order status.");
    }
  };

  const openProductForm = (product = null) => {
    if (product) { setEditingProduct(product); setProductForm({ ...product, availability:Boolean(product.availability) }); }
    else { setEditingProduct(null); setProductForm({ name:"", description:"", price:"", image:"", stock_quantity:"", availability:true }); }
    setShowProductModal(true);
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const url = editingProduct ? `/api/products/${editingProduct.id}` : "/api/products";
    const method = editingProduct ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify(productForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to save product.");
      }
      showToast("Product saved!");
      await fetchData(true);
      setShowProductModal(false);
      setEditingProduct(null);
    } catch (err) {
      showToast(err.message || "Failed to save product.");
    }
  };

  const handleDeleteProduct = (id) => {
    if (currentAdmin?.role === 'staff') {
      showToast("Permission denied: Only store owners can delete products.");
      return;
    }
    setConfirmInput("");
    setConfirmModal({
      title: "🗑️ Delete Product",
      message: "Are you sure you want to delete this product? This cannot be undone.",
      confirmLabel: "Yes, Delete",
      confirmColor: "#dc2626",
      confirmBg: "#fee2e2",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await fetch(`/api/products/${id}`, {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: "include",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            showToast(data.message || "Failed to delete product.");
            setConfirmModal(null);
            return;
          }
          showToast(data.message || "Product deleted.");
          setConfirmModal(null);
          await fetchData(true);
        } catch (err) {
          showToast(err.message || "Failed to delete product.");
          setConfirmModal(null);
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleUpdateStock = async (id, newStock) => {
    const val = Number(newStock);
    if (!Number.isInteger(val) || val < 0) {
      showToast("Stock quantity must be a non-negative integer.");
      return;
    }
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({ stock_quantity: val }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to update stock.");
      }
      showToast(`Stock updated to ${val}!`);
      await fetchData(true);
    } catch (err) {
      showToast(err.message || "Failed to update stock.");
    }
  };

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
      return;
    }
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } catch (_e) {}
    localStorage.removeItem("glazy_admin_token");
    localStorage.removeItem("glazy_admin_user");
    navigate("/admin/login");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!passwordForm.currentPassword) {
      return setPasswordError("Please enter your current password.");
    }
    if (passwordForm.newPassword.length < 8) {
      return setPasswordError("New password must be at least 8 characters long.");
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return setPasswordError("New passwords do not match.");
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to change password.");
      }

      showToast("Password updated successfully!");
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPasswordError(err.message || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const filteredOrders = orderFilter === "all" ? orders : orders.filter(o => {
    if (orderFilter === "pending") return o.order_status === "Pending Payment" || o.order_status === "Awaiting Payment Verification";
    if (orderFilter === "confirmed") return ["Confirmed","Processing","Preparing","Ready for Pickup"].includes(o.order_status);
    if (orderFilter === "completed") return o.order_status === "Completed";
    if (orderFilter === "cancelled") return o.order_status === "Cancelled";
    return true;
  });
  const filteredPayments = paymentFilter === "all" ? payments : payments.filter(p => p.status === paymentFilter);

  if (loading) return <div style={{ padding:"80px", textAlign:"center", color:"#5b2d1c" }}><div style={{ fontSize:"40px", marginBottom:"16px" }}>🍩</div>Loading Admin Dashboard...</div>;

  const TABS = [
    { id:"overview",    icon:"📊", label:"Overview" },
    { id:"best-sellers",icon:"🏆", label:"Best Sellers" },
    { id:"last-call",   icon:"🔥", label:"Last Call Deals", badge: lastCallData?.activeDealCount > 0 ? `${lastCallData.activeDealCount} live` : null, bc:"#fce7d4", btc:"#c2410c" },
    { id:"unclaimed",   icon:"🔔", label:"Ready / Claim", badge: unclaimedOrders.length>0 ? `${unclaimedOrders.length} ready` : null, bc:"#dcfce7", btc:"#166534" },
    { id:"payments",    icon:"💳", label:"Payments",  badge: pendingCount>0 ? pendingCount : null, bc:"#fef3c7", btc:"#92400e" },
    { id:"orders",      icon:"📦", label:"Orders",    badge: orders.length>0 ? orders.length : null, bc:"#f0c8bf", btc:"#5b2d1c" },
    { id:"products",    icon:"🍩", label:"Products",  badge: products.length>0 ? products.length : null, bc:"#f0c8bf", btc:"#5b2d1c" },
    { id:"inventory",   icon:"📋", label:"Inventory", badge: lowStockCount>0 ? `${lowStockCount} low` : null, bc:"#fee2e2", btc:"#dc2626" },
    { id:"customers",   icon:"👥", label:"Customers", badge: customers.length>0 ? customers.length : null, bc:"#f0c8bf", btc:"#5b2d1c" },
  ];

  return (
    <div className="admin-container" style={{ display:"flex", minHeight:"100vh", background:"#fffaf6", width:"100%" }}>
      <style>{`
        @media (max-width:860px) {
          .admin-container { flex-direction:column !important; }
          .admin-sidebar { width:100% !important; border-right:none !important; border-bottom:1.5px solid #f0c8bf !important; padding:14px 16px !important; box-sizing:border-box !important; }
          .admin-sidebar-header { display:flex !important; justify-content:space-between !important; align-items:center !important; margin-bottom:12px !important; }
          .admin-nav-tabs { display:flex !important; overflow-x:auto !important; white-space:nowrap !important; -webkit-overflow-scrolling:touch !important; gap:8px !important; padding-bottom:6px !important; scrollbar-width:none; }
          .admin-nav-tabs::-webkit-scrollbar { display:none; }
          .admin-nav-tabs li { margin-bottom:0 !important; flex-shrink:0 !important; }
          .admin-nav-tabs button { padding:8px 14px !important; font-size:13px !important; border-radius:20px !important; border:1px solid #f0c8bf !important; }
          .admin-sidebar-footer { display:flex !important; flex-direction:row !important; gap:8px !important; margin-top:10px !important; padding-top:10px !important; }
          .admin-sidebar-footer a, .admin-sidebar-footer button { flex:1 !important; padding:8px 12px !important; font-size:12px !important; }
          .admin-main { padding:16px 12px 40px !important; }
          .admin-stats-grid { grid-template-columns:repeat(2,1fr) !important; gap:10px !important; }
          .charts-row { grid-template-columns:1fr !important; }
        }
        .abtn { cursor:pointer; border:none; border-radius:6px; padding:6px 12px; font-weight:700; font-size:12px; transition:opacity .15s; }
        .abtn:hover { opacity:.85; }
        .filter-pill { padding:6px 14px; border-radius:20px; border:1.5px solid #f0c8bf; background:#fff; cursor:pointer; font-size:13px; font-weight:600; transition:all .15s; }
        .filter-pill.active { background:#d96c4a; color:#fff; border-color:#d96c4a; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {toast && <div style={{ position:"fixed", bottom:"24px", right:"24px", background:"#5b2d1c", color:"#fff", padding:"12px 22px", borderRadius:"12px", fontWeight:700, fontSize:"14px", zIndex:9999, boxShadow:"0 4px 20px rgba(0,0,0,.2)", animation:"fadeUp .3s ease" }}>{toast}</div>}

      <div className="admin-sidebar" style={{ width:"250px", background:"#fff", borderRight:"1px solid #f0c8bf", padding:"24px", flexShrink:0 }}>
        <div className="admin-sidebar-header">
          <h2 style={{ color:"#d96c4a", marginBottom:"16px", textAlign:"center" }}>🍩 Glazy Admin</h2>
          <div style={{ background: "#fff5f0", borderRadius: "10px", padding: "10px 12px", marginBottom: "24px", border: "1px solid #f8d9d1" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#5b2d1c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {currentAdmin?.username || currentAdmin?.email}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", fontWeight: 700, background: currentAdmin?.role === "owner" ? "#dcfce7" : "#fef3c7", color: currentAdmin?.role === "owner" ? "#166534" : "#92400e" }}>
                {currentAdmin?.role === "owner" ? "Owner (Full Access)" : "Staff (Limited)"}
              </span>
            </div>
          </div>
        </div>
        <ul className="admin-nav-tabs" style={{ listStyle:"none", padding:0, margin:0 }}>
          {TABS.map(tab => (
            <li key={tab.id} style={{ marginBottom:"8px" }}>
              <button onClick={() => setActiveTab(tab.id)} style={{ width:"100%", padding:"11px 12px", textAlign:"left", borderRadius:"8px", border:"none", background:activeTab===tab.id?"#d96c4a":"transparent", color:activeTab===tab.id?"#fff":"#5b2d1c", cursor:"pointer", fontWeight:activeTab===tab.id?700:500, display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px", fontSize:"14px" }}>
                <span>{tab.icon} {tab.label}</span>
                {tab.badge != null && <span style={{ fontSize:"11px", background:activeTab===tab.id?"rgba(255,255,255,.25)":tab.bc, color:activeTab===tab.id?"#fff":tab.btc, padding:"2px 7px", borderRadius:"10px", fontWeight:700 }}>{tab.badge}</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="admin-sidebar-footer" style={{ marginTop:"24px", paddingTop:"20px", borderTop:"1px solid #f0c8bf", display:"flex", flexDirection:"column", gap:"8px" }}>
          <button onClick={() => { setShowPasswordModal(true); setPasswordError(""); }} style={{ padding:"10px", background:"#fff", border:"1px solid #f0c8bf", color:"#5b2d1c", borderRadius:"8px", cursor:"pointer", fontWeight:600, fontSize:"13px", textAlign:"center" }}>
            🔑 Change Password
          </button>
          <Link to="/" style={{ display:"block", textAlign:"center", padding:"10px", background:"#fff", border:"1px solid #d96c4a", color:"#d96c4a", borderRadius:"8px", textDecoration:"none", fontWeight:600, fontSize:"13px" }}>🍩 View Storefront</Link>
          <button onClick={handleLogout} style={{ padding:"10px", background:"#f8d9d1", color:"#d96c4a", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:700, fontSize:"13px" }}>Logout</button>
        </div>
      </div>

      <div className="admin-main" style={{ flex:1, padding:"32px", overflowY:"auto", minWidth:0 }}>
        {/* Live DB Header Bar with Refresh Button, Claim QR Scan, and Timestamp */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px", background:"#fff", border:"1px solid #f0c8bf", borderRadius:"10px", padding:"10px 16px" }}>
          <div style={{ fontSize:"13px", color:"#7a5246", display:"flex", alignItems:"center", gap:"8px" }}>
            <span style={{ width:"8px", height:"8px", borderRadius:"50%", background: isRefreshing ? "#f59e0b" : "#10b981", display:"inline-block" }}></span>
            <span>{isRefreshing ? "Syncing with live database..." : lastRefreshed ? `Live DB synced at ${lastRefreshed.toLocaleTimeString()}` : "Live Database Connected"}</span>
            {unclaimedOrders.length > 0 && (
              <span style={{ marginLeft: "8px", background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: 700 }}>
                🔔 {unclaimedOrders.length} Ready & Unclaimed
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => { setClaimModal(true); setClaimInput(""); setClaimError(""); }}
              className="abtn"
              style={{ background:"#166534", color:"#fff", padding:"6px 14px", display:"flex", alignItems:"center", gap:"6px", fontSize:"13px" }}
            >
              <span>📷</span>
              <span>Verify Claim / Scan QR</span>
            </button>
            <button
              id="admin-refresh-btn"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="abtn"
              style={{ background:"#fffaf6", border:"1.5px solid #d96c4a", color:"#d96c4a", padding:"6px 14px", display:"flex", alignItems:"center", gap:"6px", fontSize:"13px" }}
            >
              <span>🔄</span>
              <span>{isRefreshing ? "Refreshing..." : "Refresh Data"}</span>
            </button>
          </div>
        </div>

        {activeTab === "overview" && (
          <div>
            <h1 style={{ color:"#5b2d1c", marginBottom:"4px", fontSize:"24px", fontWeight:800 }}>Dashboard Overview</h1>
            <p style={{ color:"#999", marginBottom:"24px", fontSize:"13px" }}>Welcome back, {currentAdmin?.username}! Here is a live snapshot of Glazy Days.</p>

            {/* ── Stats Row ── */}
            <div className="admin-stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:"14px", marginBottom:"24px" }}>
              {[
                { label:"Total Revenue",  value:`₱${totalSales.toFixed(2)}`, color:"#d96c4a", icon:"💰" },
                { label:"Total Orders",   value:orders.length,               color:"#5b2d1c", icon:"📦" },
                { label:"Pending Verify", value:pendingCount,                 color:"#92400e", icon:"⏳" },
                { label:"Verified",       value:verifiedCount,                color:"#166534", icon:"✅" },
                { label:"Completed",      value:completedCount,               color:"#1d4ed8", icon:"🏁" },
                { label:"Customers",      value:customers.length,             color:"#7c3aed", icon:"👥" },
                { label:"Live Deals 🔥",  value:lastCallData?.activeDealCount ?? "—", color:"#c2410c", icon:"🏷️" },
              ].map(({ label, value, color, icon }) => (
                <div key={label} className="admin-stat-card" style={{ background:"#fff", borderRadius:"16px", padding:"18px 16px", border:"1.5px solid #f0c8bf", display:"flex", flexDirection:"column", gap:"6px" }}>
                  <div style={{ fontSize:"22px" }}>{icon}</div>
                  <p style={{ margin:0, color:"#9a7060", fontSize:"11px", fontWeight:700, letterSpacing:"0.5px", textTransform:"uppercase" }}>{label}</p>
                  <h3 style={{ margin:0, color, fontSize:"26px", fontWeight:900 }}>{value}</h3>
                </div>
              ))}
            </div>

            {pendingCount > 0 && (
              <div style={{ background:"#fffbea", border:"1.5px solid #f6c90e", borderRadius:"12px", padding:"14px 18px", marginBottom:"22px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <strong style={{ color:"#92400e" }}>&#9888; {pendingCount} payment{pendingCount>1?"s":""} awaiting verification!</strong>
                  <div style={{ fontSize:"12px", color:"#92400e", marginTop:"2px" }}>Buyers are waiting for their orders to be confirmed.</div>
                </div>
                <button className="abtn" onClick={() => setActiveTab("payments")} style={{ background:"#d96c4a", color:"#fff", padding:"8px 16px", fontSize:"13px" }}>Review Payments &rarr;</button>
              </div>
            )}

            {/* ── Charts Row ── */}
            <div className="charts-row" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px", marginBottom:"22px" }}>

              {/* Best Seller Bar Chart */}
              <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", padding:"20px", minHeight:"280px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px", flexWrap:"wrap", gap:"8px" }}>
                  <h2 style={{ margin:0, color:"#5b2d1c", fontSize:"16px", fontWeight:800 }}>🏆 Best Seller</h2>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {["today","week","month","all","custom"].map(p => (
                      <button key={p} onClick={() => setBestSellerPeriod(p)}
                        style={{ padding:"4px 10px", borderRadius:"16px", border:"1.5px solid", cursor:"pointer", fontSize:"11px", fontWeight:700,
                          borderColor: bestSellerPeriod===p ? "#d96c4a" : "#f0c8bf",
                          background: bestSellerPeriod===p ? "#d96c4a" : "#fff8f5",
                          color: bestSellerPeriod===p ? "#fff" : "#9a7060" }}>
                        {p === "custom" ? "Custom" : p.charAt(0).toUpperCase()+p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                {bestSellerPeriod === "custom" && (
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px", padding:"8px 12px", background:"#fff8f5", borderRadius:"10px", border:"1px solid #f0c8bf", flexWrap:"wrap", fontSize:"12px" }}>
                    <span style={{ color:"#9a7060", fontWeight:700 }}>Range:</span>
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
                      style={{ padding:"3px 8px", borderRadius:"6px", border:"1px solid #f0c8bf", fontSize:"11px" }} />
                    <span style={{ color:"#9a7060" }}>to</span>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
                      style={{ padding:"3px 8px", borderRadius:"6px", border:"1px solid #f0c8bf", fontSize:"11px" }} />
                    <button className="abtn" onClick={() => { if (customStartDate && customEndDate) fetchBestSellers("custom", customStartDate, customEndDate); }}
                      style={{ background:"#d96c4a", color:"#fff", padding:"4px 10px", fontSize:"11px" }}>Filter</button>
                  </div>
                )}
                {bestSellers.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 0", color:"#ccc", fontSize:"13px" }}>No sales data yet for this period.</div>
                ) : (
                  <div style={{ overflowX:"auto" }}>
                    <div style={{ minWidth:"300px" }}>
                      {/* SVG Bar Chart */}
                      <BestSellerBarChart data={bestSellers.slice(0,6)} />
                    </div>
                  </div>
                )}
                <div style={{ marginTop:"12px", textAlign:"right" }}>
                  <button className="abtn" onClick={() => setActiveTab("best-sellers")} style={{ background:"#f0c8bf", color:"#5b2d1c", padding:"5px 12px", fontSize:"12px" }}>Full Report →</button>
                </div>
              </div>

              {/* Sales Rate Area Chart */}
              <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", padding:"20px", minHeight:"280px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
                  <h2 style={{ margin:0, color:"#5b2d1c", fontSize:"16px", fontWeight:800 }}>📈 Sales Rate</h2>
                  <span style={{ fontSize:"11px", background:"#fff0e8", color:"#d96c4a", padding:"4px 10px", borderRadius:"12px", fontWeight:700 }}>Monthly Revenue</span>
                </div>
                {salesRate.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 0", color:"#ccc", fontSize:"13px" }}>No revenue data available yet.</div>
                ) : (
                  <SalesRateAreaChart data={salesRate} />
                )}
              </div>
            </div>

            {/* ── Recent Orders ── */}
            <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #f7e5de", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <h2 style={{ margin:0, color:"#5b2d1c", fontSize:"16px", fontWeight:800 }}>📋 Recent Orders</h2>
                <button className="abtn" onClick={() => setActiveTab("orders")} style={{ background:"#f0c8bf", color:"#5b2d1c", padding:"6px 14px", fontSize:"12px" }}>See All</button>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", minWidth:"500px", borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                    {["Order #","Customer","Total","Payment","Status"].map(h => <th key={h} style={{ padding:"11px 16px", fontSize:"12px", color:"#9a7060", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.4px" }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {orders.slice(0,6).map(o => (
                      <tr key={o.id} style={{ borderTop:"1px solid #f6e3de" }}>
                        <td style={{ padding:"11px 16px", fontWeight:800, color:"#d96c4a", fontSize:"13px" }}>{o.order_number}</td>
                        <td style={{ padding:"11px 16px" }}><div style={{ fontWeight:600, fontSize:"13px" }}>{o.customer_name}</div><div style={{ fontSize:"11px", color:"#aaa" }}>{o.customer_email}</div></td>
                        <td style={{ padding:"11px 16px", fontWeight:700 }}>₱{Number(o.total_amount).toFixed(2)}</td>
                        <td style={{ padding:"11px 16px" }}>{paymentBadge(o.payment_status)}</td>
                        <td style={{ padding:"11px 16px" }}>{orderStatusBadge(o.order_status)}</td>
                      </tr>
                    ))}
                    {orders.length === 0 && <tr><td colSpan="5" style={{ padding:"28px", textAlign:"center", color:"#ccc" }}>No orders yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Best Sellers Full Tab ── */}
        {activeTab === "best-sellers" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
              <div>
                <h1 style={{ color:"#5b2d1c", margin:0, fontSize:"24px", fontWeight:800 }}>🏆 Best Seller Report</h1>
                <p style={{ color:"#999", margin:"4px 0 0", fontSize:"13px" }}>Top-selling products aggregated from existing order history.</p>
              </div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {["today","week","month","all","custom"].map(p => (
                  <button key={p} onClick={() => setBestSellerPeriod(p)}
                    style={{ padding:"7px 16px", borderRadius:"20px", border:"1.5px solid", cursor:"pointer", fontSize:"12px", fontWeight:700,
                      borderColor: bestSellerPeriod===p ? "#d96c4a" : "#f0c8bf",
                      background: bestSellerPeriod===p ? "#d96c4a" : "#fff",
                      color: bestSellerPeriod===p ? "#fff" : "#9a7060" }}>
                    {p === "custom" ? "Custom Range" : p.charAt(0).toUpperCase()+p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {bestSellerPeriod === "custom" && (
              <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px", padding:"12px 18px", background:"#fff", borderRadius:"12px", border:"1.5px solid #f0c8bf", flexWrap:"wrap", fontSize:"13px" }}>
                <span style={{ color:"#5b2d1c", fontWeight:700 }}>Custom Date Range:</span>
                <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
                  style={{ padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #f0c8bf", fontSize:"13px" }} />
                <span style={{ color:"#9a7060", fontWeight:600 }}>to</span>
                <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
                  style={{ padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #f0c8bf", fontSize:"13px" }} />
                <button className="abtn" onClick={() => { if (customStartDate && customEndDate) fetchBestSellers("custom", customStartDate, customEndDate); }}
                  style={{ background:"#d96c4a", color:"#fff", padding:"7px 16px", fontSize:"13px" }}>Filter Range</button>
              </div>
            )}

            {bestSellers.length === 0 ? (
              <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", padding:"60px", textAlign:"center", color:"#bbb" }}>
                <div style={{ fontSize:"40px", marginBottom:"12px" }}>🍩</div>
                <div>No sales data for this period.</div>
              </div>
            ) : (
              <div style={{ display:"grid", gap:"16px" }}>
                {/* Large bar chart */}
                <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", padding:"28px" }}>
                  <BestSellerBarChart data={bestSellers} tall />
                </div>
                {/* Detail table */}
                <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", overflow:"hidden" }}>
                  <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0c8bf" }}>
                    <h2 style={{ margin:0, color:"#5b2d1c", fontSize:"16px", fontWeight:800 }}>Detailed Rankings</h2>
                  </div>
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"600px" }}>
                      <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                        {["Rank","Product","Units Sold","Revenue","% of Sales","Stock"].map(h =>
                          <th key={h} style={{ padding:"11px 16px", fontSize:"11px", color:"#9a7060", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                        )}
                      </tr></thead>
                      <tbody>
                        {bestSellers.map(p => (
                          <tr key={p.productId} style={{ borderTop:"1px solid #f6e3de" }}>
                            <td style={{ padding:"12px 16px" }}>
                              <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"28px", height:"28px", borderRadius:"50%",
                                background: p.rank===1?"#fbbf24":p.rank===2?"#9ca3af":p.rank===3?"#cd7c36":"#f0c8bf",
                                color: p.rank<=3?"#fff":"#5b2d1c", fontWeight:900, fontSize:"13px" }}>{p.rank}</span>
                            </td>
                            <td style={{ padding:"12px 16px" }}>
                              <div style={{ fontWeight:700, fontSize:"14px", color:"#5b2d1c" }}>{p.productName}</div>
                              <div style={{ fontSize:"11px", color:"#aaa" }}>₱{p.currentPrice.toFixed(2)}</div>
                            </td>
                            <td style={{ padding:"12px 16px", fontWeight:800, color:"#d96c4a", fontSize:"16px" }}>{p.unitsSold}</td>
                            <td style={{ padding:"12px 16px", fontWeight:700 }}>₱{p.salesRevenue.toFixed(2)}</td>
                            <td style={{ padding:"12px 16px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                                <div style={{ flex:1, height:"6px", background:"#f0c8bf", borderRadius:"3px" }}>
                                  <div style={{ width:`${p.percentageOfUnits}%`, height:"100%", background:"#d96c4a", borderRadius:"3px" }} />
                                </div>
                                <span style={{ fontSize:"11px", fontWeight:700, color:"#d96c4a" }}>{p.percentageOfUnits}%</span>
                              </div>
                            </td>
                            <td style={{ padding:"12px 16px" }}>
                              <span style={{ fontSize:"12px", fontWeight:700, padding:"3px 8px", borderRadius:"8px",
                                background: p.stockStatus==="out_of_stock"?"#fee2e2":p.stockStatus==="low_stock"?"#fef3c7":"#dcfce7",
                                color: p.stockStatus==="out_of_stock"?"#dc2626":p.stockStatus==="low_stock"?"#92400e":"#166534" }}>
                                {p.currentStock} units
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Last Call Deals Tab ── */}
        {activeTab === "last-call" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
              <div>
                <h1 style={{ color:"#5b2d1c", margin:0, fontSize:"24px", fontWeight:800 }}>🔥 Last Call Deals</h1>
                <p style={{ color:"#999", margin:"4px 0 0", fontSize:"13px" }}>Automatic end-of-day discounts on slow-moving inventory. Zero changes to core pricing data.</p>
              </div>
              <button className="abtn" onClick={fetchLastCallData} style={{ background:"#fff0e8", border:"1.5px solid #d96c4a", color:"#d96c4a", padding:"8px 16px", fontSize:"13px" }}>🔄 Refresh</button>
            </div>

            {/* Window status banner */}
            {lastCallData && (
              <div style={{ borderRadius:"12px", padding:"14px 20px", marginBottom:"20px", border:"1.5px solid",
                background: lastCallData.windowStatus?.active ? "#fff7ed" : "#f9fafb",
                borderColor: lastCallData.windowStatus?.active ? "#f97316" : "#e5e7eb" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <span style={{ fontSize:"20px" }}>{lastCallData.windowStatus?.active ? "🟠" : "⚫"}</span>
                  <div>
                    <div style={{ fontWeight:800, color: lastCallData.windowStatus?.active ? "#c2410c" : "#374151", fontSize:"14px" }}>
                      {lastCallData.windowStatus?.active ? `🔥 Last Call is LIVE! ${lastCallData.activeDealCount} active deals right now.` : "Last Call window is not active."}
                    </div>
                    <div style={{ fontSize:"12px", color:"#888", marginTop:"2px" }}>{lastCallData.windowStatus?.reason}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Settings Panel (owner only) */}
            {currentAdmin?.role === "owner" && lastCallSettings && lcSettingsForm && (
              <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", padding:"20px", marginBottom:"20px" }}>
                <h2 style={{ color:"#5b2d1c", margin:"0 0 16px", fontSize:"16px", fontWeight:800 }}>⚙️ Deal Settings</h2>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"14px" }}>
                  {[
                    { key:"startTime",       label:"Start Time",        type:"time" },
                    { key:"endTime",         label:"End Time",          type:"time" },
                    { key:"minStock",        label:"Min Stock Required", type:"number" },
                    { key:"minDiscount",     label:"Min Discount %",    type:"number" },
                    { key:"maxDiscount",     label:"Max Discount %",    type:"number" },
                    { key:"maxDailySales",   label:"Max Daily Sales (threshold)", type:"number" },
                  ].map(({ key, label, type }) => (
                    <div key={key}>
                      <label style={{ fontSize:"11px", fontWeight:700, color:"#9a7060", display:"block", marginBottom:"4px", textTransform:"uppercase" }}>{label}</label>
                      <input type={type} value={lcSettingsForm[key] ?? ""}
                        onChange={e => setLcSettingsForm(prev => ({ ...prev, [key]: type==="number" ? Number(e.target.value) : e.target.value }))}
                        style={{ width:"100%", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #f0c8bf", fontSize:"13px", boxSizing:"border-box" }} />
                    </div>
                  ))}
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <label style={{ fontSize:"11px", fontWeight:700, color:"#9a7060", textTransform:"uppercase" }}>Enabled</label>
                    <input type="checkbox" checked={lcSettingsForm.enabled} onChange={e => setLcSettingsForm(prev => ({ ...prev, enabled: e.target.checked }))} style={{ width:"18px", height:"18px", cursor:"pointer" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:"11px", fontWeight:700, color:"#9a7060", display:"block", marginBottom:"4px", textTransform:"uppercase" }}>Manual Override</label>
                    <select value={lcSettingsForm.manualOverride} onChange={e => setLcSettingsForm(prev => ({ ...prev, manualOverride: e.target.value }))}
                      style={{ width:"100%", padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #f0c8bf", fontSize:"13px", background:"#fff" }}>
                      <option value="auto">Auto (Scheduled)</option>
                      <option value="force_on">Force ON (Testing)</option>
                      <option value="force_off">Force OFF</option>
                    </select>
                  </div>
                </div>
                <div style={{ marginTop:"16px", display:"flex", gap:"10px" }}>
                  <button className="abtn" disabled={savingLCSettings}
                    onClick={async () => {
                      setSavingLCSettings(true);
                      try {
                        const res = await fetch("/api/deals/last-call/settings", {
                          method:"PUT",
                          headers: { "Content-Type":"application/json", ...(token ? { Authorization:`Bearer ${token}` } : {}) },
                          credentials:"include",
                          body: JSON.stringify(lcSettingsForm),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data.message || "Failed to save");
                        showToast("✅ Last Call settings saved!");
                        await fetchLastCallData();
                      } catch (err) {
                        showToast(err.message || "Save failed.");
                      } finally {
                        setSavingLCSettings(false);
                      }
                    }}
                    style={{ background:"#d96c4a", color:"#fff", padding:"9px 20px", fontSize:"13px" }}>
                    {savingLCSettings ? "Saving..." : "💾 Save Settings"}
                  </button>
                  <button className="abtn" onClick={() => setLcSettingsForm(lastCallSettings)}
                    style={{ background:"#f0c8bf", color:"#5b2d1c", padding:"9px 20px", fontSize:"13px" }}>Reset</button>
                </div>
              </div>
            )}

            {/* Deals Product Table */}
            <div style={{ background:"#fff", borderRadius:"16px", border:"1.5px solid #f0c8bf", overflow:"hidden" }}>
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #f0c8bf", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <h2 style={{ margin:0, color:"#5b2d1c", fontSize:"16px", fontWeight:800 }}>All Products — Deal Evaluation</h2>
                <div style={{ display:"flex", gap:"10px", fontSize:"12px" }}>
                  <span style={{ background:"#fff7ed", color:"#c2410c", padding:"4px 10px", borderRadius:"10px", fontWeight:700 }}>🔥 {lastCallData?.activeDealCount ?? 0} Active</span>
                  <span style={{ background:"#dcfce7", color:"#166534", padding:"4px 10px", borderRadius:"10px", fontWeight:700 }}>✅ {lastCallData?.eligibleCount ?? 0} Eligible</span>
                </div>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"700px" }}>
                  <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                    {["Product","Stock","Original Price","Deal Price","Discount","Today's Sales","Status"].map(h =>
                      <th key={h} style={{ padding:"11px 16px", fontSize:"11px", color:"#9a7060", fontWeight:700, textTransform:"uppercase" }}>{h}</th>
                    )}
                  </tr></thead>
                  <tbody>
                    {(lastCallData?.allProducts || []).map(p => (
                      <tr key={p.productId} style={{ borderTop:"1px solid #f6e3de", background: p.isDealActive ? "#fff7ed" : "#fff" }}>
                        <td style={{ padding:"12px 16px" }}>
                          <div style={{ fontWeight:700, color:"#5b2d1c", fontSize:"13px" }}>{p.productName}</div>
                          <div style={{ fontSize:"11px", color:"#aaa" }}>{p.description?.slice(0,40)}</div>
                        </td>
                        <td style={{ padding:"12px 16px", fontWeight:700 }}>{p.stockQuantity}</td>
                        <td style={{ padding:"12px 16px" }}>₱{p.originalPrice.toFixed(2)}</td>
                        <td style={{ padding:"12px 16px", fontWeight:800, color: p.isEligible ? "#c2410c" : "#aaa" }}>
                          {p.isEligible ? `₱${p.discountedPrice.toFixed(2)}` : "—"}
                        </td>
                        <td style={{ padding:"12px 16px" }}>
                          {p.isEligible ? (
                            <span style={{ background:"#fff7ed", color:"#c2410c", padding:"3px 8px", borderRadius:"8px", fontSize:"12px", fontWeight:800 }}>{p.discountPercentage}% OFF</span>
                          ) : "—"}
                        </td>
                        <td style={{ padding:"12px 16px" }}>{p.todaySales}</td>
                        <td style={{ padding:"12px 16px" }}>
                          <span style={{ fontSize:"11px", fontWeight:700, padding:"3px 9px", borderRadius:"8px",
                            background: p.isDealActive?"#fff7ed":p.isEligible?"#f0fdf4":"#f3f4f6",
                            color: p.isDealActive?"#c2410c":p.isEligible?"#166534":"#6b7280" }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!lastCallData?.allProducts || lastCallData.allProducts.length === 0) && (
                      <tr><td colSpan="7" style={{ padding:"40px", textAlign:"center", color:"#bbb" }}>No products evaluated yet. Click Refresh.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "unclaimed" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px", flexWrap:"wrap", gap:"12px" }}>
              <div>
                <h1 style={{ color:"#5b2d1c", margin:0 }}>🔔 Ready & Unclaimed Orders</h1>
                <p style={{ color:"#7a5246", margin:"4px 0 0", fontSize:"13px" }}>
                  Orders ready at the pickup counter. Live timers show how long each customer has waited since being notified.
                </p>
              </div>
              <button
                onClick={() => { setClaimModal(true); setClaimInput(""); setClaimError(""); }}
                className="abtn"
                style={{ background: "#166534", color: "#fff", padding: "10px 18px", fontSize: "14px" }}
              >
                📷 Scan / Verify Claim QR
              </button>
            </div>

            {/* Unclaimed Summary Cards */}
            <div className="admin-stats-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"14px", marginBottom:"24px" }}>
              <div className="admin-stat-card" style={{ background:"#fff", borderRadius:"12px", padding:"16px", border:"1px solid #f0c8bf" }}>
                <p style={{ margin:0, color:"#7a5246", fontSize:"11px", fontWeight:600 }}>Total Waiting at Counter</p>
                <h3 style={{ margin:"8px 0 0", color:"#5b2d1c", fontSize:"26px", fontWeight:800 }}>{unclaimedOrders.length}</h3>
              </div>
              <div className="admin-stat-card" style={{ background:"#fff", borderRadius:"12px", padding:"16px", border:"1px solid #f0c8bf" }}>
                <p style={{ margin:0, color:"#92400e", fontSize:"11px", fontWeight:600 }}>Escalated (&gt;10 mins)</p>
                <h3 style={{ margin:"8px 0 0", color:"#d97706", fontSize:"26px", fontWeight:800 }}>
                  {unclaimedOrders.filter(o => {
                    const elapsed = o.ready_notified_at ? (nowTime - new Date(o.ready_notified_at).getTime()) / 60000 : 0;
                    return elapsed >= 10 && elapsed < 20;
                  }).length}
                </h3>
              </div>
              <div className="admin-stat-card" style={{ background:"#fff", borderRadius:"12px", padding:"16px", border:"1px solid #f0c8bf" }}>
                <p style={{ margin:0, color:"#dc2626", fontSize:"11px", fontWeight:600 }}>Critical (&gt;20 mins)</p>
                <h3 style={{ margin:"8px 0 0", color:"#dc2626", fontSize:"26px", fontWeight:800 }}>
                  {unclaimedOrders.filter(o => {
                    const elapsed = o.ready_notified_at ? (nowTime - new Date(o.ready_notified_at).getTime()) / 60000 : 0;
                    return elapsed >= 20;
                  }).length}
                </h3>
              </div>
            </div>

            {/* Unclaimed Orders Table */}
            <div style={{ background:"#fff", borderRadius:"12px", border:"1.5px solid #f0c8bf", overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"860px" }}>
                <thead>
                  <tr style={{ background:"#fff7f2", textAlign:"left" }}>
                    {["Queue #","Order #","Customer","Total","Notified At","Elapsed Wait Time","Calls","Actions"].map(h => (
                      <th key={h} style={{ padding:"12px 14px", fontSize:"13px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {unclaimedOrders.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ padding:"36px", textAlign:"center", color:"#bbb" }}>
                        ✨ No unclaimed orders! All ready orders have been claimed by customers.
                      </td>
                    </tr>
                  )}
                  {unclaimedOrders.map((o) => {
                    const startTime = o.ready_notified_at ? new Date(o.ready_notified_at).getTime() : nowTime;
                    const elapsedSec = Math.max(0, Math.floor((nowTime - startTime) / 1000));
                    const elapsedMin = Math.floor(elapsedSec / 60);
                    const remSec = elapsedSec % 60;

                    let badgeBg = "#dcfce7";
                    let badgeColor = "#166534";
                    let label = `${elapsedMin}m ${remSec}s`;

                    if (elapsedMin >= 20) {
                      badgeBg = "#fee2e2";
                      badgeColor = "#dc2626";
                      label = `⚠ ${elapsedMin}m ${remSec}s (Critical)`;
                    } else if (elapsedMin >= 10) {
                      badgeBg = "#fef3c7";
                      badgeColor = "#92400e";
                      label = `⏳ ${elapsedMin}m ${remSec}s (Escalated)`;
                    }

                    return (
                      <tr key={o.id} style={{ borderTop:"1px solid #f6e3de" }}>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:"18px", fontWeight:900, color:"#d96c4a", background:"#fff5f0", padding:"4px 10px", borderRadius:"8px", border:"1px solid #f8d9d1" }}>
                            {o.queue_number || "—"}
                          </span>
                        </td>
                        <td style={{ padding:"12px 14px", fontWeight:700, color:"#5b2d1c" }}>
                          {o.order_number}
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ fontWeight:600, fontSize:"13px" }}>{o.customer_name}</div>
                          <div style={{ fontSize:"11px", color:"#888" }}>{o.customer_contact}</div>
                        </td>
                        <td style={{ padding:"12px 14px", fontWeight:700 }}>
                          ₱{Number(o.total_amount).toFixed(2)}
                        </td>
                        <td style={{ padding:"12px 14px", fontSize:"12px", color:"#7a5246" }}>
                          {o.ready_notified_at ? new Date(o.ready_notified_at).toLocaleTimeString() : "Just now"}
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ background:badgeBg, color:badgeColor, padding:"4px 10px", borderRadius:"12px", fontWeight:700, fontSize:"12px", whiteSpace:"nowrap" }}>
                            {label}
                          </span>
                        </td>
                        <td style={{ padding:"12px 14px", fontSize:"12px", textAlign:"center", fontWeight:600 }}>
                          {o.reminder_count || 0}
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                            <button
                              onClick={() => handleCallNumber(o.id, o.queue_number)}
                              className="abtn"
                              style={{ background:"#f0c8bf", color:"#5b2d1c" }}
                              title="Re-announce number on store board"
                            >
                              📢 Call Number
                            </button>
                            <button
                              onClick={() => handleVerifyClaim({ orderNumber: o.order_number, trackingToken: o.tracking_token })}
                              className="abtn"
                              style={{ background:"#166534", color:"#fff" }}
                              title="Confirm customer picked up order"
                            >
                              ✅ Mark Claimed
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "payments" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px", flexWrap:"wrap", gap:"12px" }}>
              <h1 style={{ color:"#5b2d1c", margin:0 }}>&#128179; Payment Verification</h1>
              <div style={{ fontSize:"13px", color:"#888" }}>{pendingCount} awaiting review</div>
            </div>
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
              {["all","Pending Verification","Verified","Rejected"].map(f => (
                <button key={f} className={`filter-pill${paymentFilter===f?" active":""}`} onClick={() => setPaymentFilter(f)}>{f==="all"?"All":f}</button>
              ))}
            </div>
            <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #f0c8bf", overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"920px" }}>
                <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                  {["Order #","Customer","Amount","Method","Reference #","Payment Status","Order Status","Date","Actions"].map(h => <th key={h} style={{ padding:"12px 14px", fontSize:"13px" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredPayments.length === 0 && <tr><td colSpan="9" style={{ padding:"32px", textAlign:"center", color:"#bbb" }}>No payments found.</td></tr>}
                  {filteredPayments.map(p => {
                    const isPending = p.status === "Pending Verification";
                    const isVerified = p.status === "Verified";
                    return (
                      <tr key={p.id} style={{ borderTop:"1px solid #f6e3de", background:isPending?"#fffdf5":"#fff" }}>
                        <td style={{ padding:"12px 14px", fontWeight:700, color:"#d96c4a", whiteSpace:"nowrap" }}>{p.order_number}</td>
                        <td style={{ padding:"12px 14px" }}><div style={{ fontWeight:600, fontSize:"13px" }}>{p.customer_name}</div><div style={{ fontSize:"11px", color:"#888" }}>{p.customer_email}</div></td>
                        <td style={{ padding:"12px 14px", fontWeight:700, whiteSpace:"nowrap" }}>\u20B1{Number(p.amount).toFixed(2)}</td>
                        <td style={{ padding:"12px 14px" }}>{p.payment_method}</td>
                        <td style={{ padding:"12px 14px" }}>{p.payment_reference ? <span style={{ fontFamily:"monospace", background:"#f0f0f0", padding:"2px 6px", borderRadius:"4px", fontSize:"13px" }}>{p.payment_reference}</span> : <span style={{ color:"#bbb", fontSize:"12px" }}>Not provided</span>}</td>
                        <td style={{ padding:"12px 14px" }}>{paymentBadge(p.status)}</td>
                        <td style={{ padding:"12px 14px" }}>{orderStatusBadge(p.order_status)}</td>
                        <td style={{ padding:"12px 14px", fontSize:"12px", color:"#888", whiteSpace:"nowrap" }}>{new Date(p.created_at).toLocaleDateString()}</td>
                        <td style={{ padding:"12px 14px" }}>
                          {isPending ? (
                            <div style={{ display:"flex", gap:"6px" }}>
                              <button id={`verify-payment-${p.id}`} className="abtn" onClick={() => handleVerifyPayment(p.id,"verify")} style={{ background:"#166534", color:"#fff" }}>&#10003; Verify</button>
                              <button id={`reject-payment-${p.id}`} className="abtn" onClick={() => handleVerifyPayment(p.id,"reject")} style={{ background:"transparent", color:"#dc2626", border:"1px solid #dc2626" }}>&#10007; Reject</button>
                            </div>
                          ) : (
                            <div style={{ fontSize:"12px", color:isVerified?"#166534":"#dc2626" }}>
                              {isVerified?"&#10003; Verified":"&#10007; Rejected"}
                              {p.verified_at && <div style={{ fontSize:"10px", color:"#aaa" }}>{new Date(p.verified_at).toLocaleDateString()}</div>}
                              {p.admin_notes && <div style={{ fontSize:"10px", color:"#888", fontStyle:"italic" }}>{p.admin_notes}</div>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px", flexWrap:"wrap", gap:"12px" }}>
              <h1 style={{ color:"#5b2d1c", margin:0 }}>&#128230; Customer Orders</h1>
              <span style={{ fontSize:"13px", color:"#888" }}>{orders.length} total order{orders.length!==1?"s":""}</span>
            </div>
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
              {[{id:"all",label:"All"},{id:"pending",label:"Pending"},{id:"confirmed",label:"Confirmed"},{id:"completed",label:"Completed"},{id:"cancelled",label:"Cancelled"}].map(f => (
                <button key={f.id} className={`filter-pill${orderFilter===f.id?" active":""}`} onClick={() => setOrderFilter(f.id)}>{f.label}</button>
              ))}
            </div>
            <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #f0c8bf", overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"880px" }}>
                <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                  {["Queue #","Order #","Customer","Total","Payment","Order Status","Pickup","Actions"].map(h => <th key={h} style={{ padding:"12px 14px", fontSize:"13px" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {filteredOrders.length === 0 && <tr><td colSpan="8" style={{ padding:"32px", textAlign:"center", color:"#bbb" }}>No orders found.</td></tr>}
                  {filteredOrders.map(o => (
                    <React.Fragment key={o.id}>
                      <tr style={{ borderTop:"1px solid #f6e3de", cursor:"pointer" }} onClick={() => setExpandedOrder(expandedOrder===o.id?null:o.id)}>
                        <td style={{ padding:"12px 14px" }}>
                          <span style={{ fontSize:"15px", fontWeight:800, color:"#d96c4a", background:"#fff5f0", padding:"3px 8px", borderRadius:"6px", border:"1px solid #f8d9d1" }}>
                            {o.queue_number || "—"}
                          </span>
                        </td>
                        <td style={{ padding:"12px 14px", fontWeight:700, color:"#5b2d1c" }}>
                          <span style={{ marginRight:"4px", fontSize:"10px", color:"#aaa" }}>{expandedOrder===o.id?"v":">"}</span>
                          {o.order_number}
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <div style={{ fontWeight:600, fontSize:"13px" }}>{o.customer_name}</div>
                          <div style={{ fontSize:"11px", color:"#888" }}>{o.customer_email}</div>
                          <div style={{ fontSize:"11px", color:"#aaa" }}>{o.customer_contact}</div>
                        </td>
                        <td style={{ padding:"12px 14px", fontWeight:700 }}>\u20B1{Number(o.total_amount).toFixed(2)}</td>
                        <td style={{ padding:"12px 14px" }}>{paymentBadge(o.payment_status)}</td>
                        <td style={{ padding:"12px 14px" }} onClick={e => e.stopPropagation()}>
                          <select value={o.order_status||"Pending Payment"} onChange={e => handleUpdateOrderStatus(o.id,e.target.value,o)} style={{ padding:"6px 10px", borderRadius:"6px", border:"1px solid #f0c8bf", fontSize:"13px", cursor:"pointer", background:"#fff" }}>
                            {["Pending Payment","Awaiting Payment Verification","Confirmed","Processing","Preparing","Ready for Pickup","Completed","Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding:"12px 14px", fontSize:"12px", color:"#5b2d1c" }}>{o.pickup_date||"N/A"}<br /><span style={{ color:"#888" }}>{o.pickup_time||""}</span></td>
                        <td style={{ padding:"12px 14px" }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                            <Link to={`/track/${o.order_number}`} target="_blank" style={{ color:"#166534", textDecoration:"none", fontWeight:700, fontSize:"12px" }}>Track</Link>
                            <span style={{ color:"#ccc" }}>|</span>
                            <Link to={`/receipt/${o.order_number}`} target="_blank" style={{ color:"#d96c4a", textDecoration:"none", fontWeight:700, fontSize:"12px" }}>Receipt</Link>
                          </div>
                        </td>
                      </tr>
                      {expandedOrder === o.id && (
                        <tr>
                          <td colSpan="8" style={{ padding:"0 14px 18px 40px" }}>
                            <div style={{ background:"#fff8f5", border:"1px solid #f0c8bf", borderRadius:"10px", padding:"14px 18px", marginTop:"4px" }}>
                              <div style={{ display:"flex", gap:"20px", flexWrap:"wrap", marginBottom:"12px", fontSize:"13px", alignItems:"center" }}>
                                <div><strong>Address:</strong> {o.customer_address||"N/A"}</div>
                                <div><strong>Method:</strong> {o.payment_method||"N/A"}</div>
                                {o.payment_reference && <div><strong>Ref #:</strong> <code style={{ background:"#f0f0f0", padding:"1px 6px", borderRadius:"4px" }}>{o.payment_reference}</code></div>}
                                <div><strong>Placed:</strong> {new Date(o.created_at).toLocaleString()}</div>
                                {o.payment_status === "Pending Verification" && (
                                  <div style={{ marginLeft:"auto", display:"flex", gap:"6px" }}>
                                    <button className="abtn" onClick={() => handleVerifyPayment(o.id, "verify")} style={{ background:"#166534", color:"#fff", fontSize:"12px", padding:"5px 12px" }}>&#10003; Verify Payment</button>
                                    <button className="abtn" onClick={() => handleVerifyPayment(o.id, "reject")} style={{ background:"transparent", color:"#dc2626", border:"1px solid #dc2626", fontSize:"12px", padding:"5px 12px" }}>&#10007; Reject Payment</button>
                                  </div>
                                )}
                              </div>
                              {o.items && o.items.length > 0 ? (
                                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"13px", maxWidth:"520px" }}>
                                  <thead><tr style={{ background:"#fff1eb" }}>
                                    <th style={{ padding:"8px 10px", textAlign:"left" }}>Item</th>
                                    <th style={{ padding:"8px 10px", textAlign:"center" }}>Qty</th>
                                    <th style={{ padding:"8px 10px", textAlign:"right" }}>Unit Price</th>
                                    <th style={{ padding:"8px 10px", textAlign:"right" }}>Subtotal</th>
                                  </tr></thead>
                                  <tbody>
                                    {o.items.map((item,i) => (
                                      <tr key={i} style={{ borderTop:"1px solid #f1ddcf" }}>
                                        <td style={{ padding:"7px 10px" }}>{item.name}</td>
                                        <td style={{ padding:"7px 10px", textAlign:"center" }}>{item.quantity}</td>
                                        <td style={{ padding:"7px 10px", textAlign:"right" }}>\u20B1{Number(item.unitPrice||item.price||0).toFixed(2)}</td>
                                        <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700 }}>\u20B1{Number(item.subtotal||(item.quantity*(item.unitPrice||item.price||0))).toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot><tr style={{ borderTop:"2px solid #f0c8bf" }}>
                                    <td colSpan="3" style={{ padding:"8px 10px", fontWeight:700, textAlign:"right" }}>TOTAL</td>
                                    <td style={{ padding:"8px 10px", fontWeight:800, textAlign:"right", color:"#d96c4a" }}>\u20B1{Number(o.total_amount).toFixed(2)}</td>
                                  </tr></tfoot>
                                </table>
                              ) : <p style={{ color:"#aaa", fontSize:"13px", margin:0 }}>Item details not available for this order.</p>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "products" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"22px" }}>
              <h1 style={{ color:"#5b2d1c", margin:0 }}>&#127849; Products</h1>
              <button className="abtn" onClick={() => openProductForm()} style={{ background:"#d96c4a", color:"#fff", padding:"10px 18px", fontSize:"14px" }}>+ Add Product</button>
            </div>
            <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #f0c8bf", overflowX:"auto" }}>
              <table style={{ width:"100%", minWidth:"620px", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                  {["Image","Name","Description","Price","Stock","Available","Actions"].map(h => <th key={h} style={{ padding:"12px 14px", fontSize:"13px" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {products.map(p => {
                    const imgSrc = (typeof getDonutImage === "function") ? getDonutImage(p) : (p.image||"");
                    const stock = Number(p.stock_quantity ?? 0);
                    return (
                      <tr key={p.id} style={{ borderTop:"1px solid #f6e3de" }}>
                        <td style={{ padding:"10px 14px" }}><img src={imgSrc} alt={p.name} style={{ width:"44px", height:"44px", objectFit:"cover", borderRadius:"8px", border:"1px solid #f0c8bf" }} onError={e => { e.target.style.display="none"; }} /></td>
                        <td style={{ padding:"10px 14px", fontWeight:700, color:"#5b2d1c" }}>{p.name}</td>
                        <td style={{ padding:"10px 14px", fontSize:"12px", color:"#888", maxWidth:"160px" }}>{p.description||"N/A"}</td>
                        <td style={{ padding:"10px 14px", fontWeight:700, color:"#d96c4a" }}>\u20B1{Number(p.price).toFixed(2)}</td>
                        <td style={{ padding:"10px 14px" }}>
                          <span style={{ background:stock>5?"#dcfce7":stock>0?"#fef3c7":"#fee2e2", color:stock>5?"#166534":stock>0?"#92400e":"#dc2626", padding:"3px 8px", borderRadius:"10px", fontWeight:700, fontSize:"12px" }}>{p.stock_quantity??"\u221e"}</span>
                        </td>
                        <td style={{ padding:"10px 14px" }}><span style={{ color:p.availability?"#166534":"#dc2626", fontWeight:700 }}>{p.availability?"Yes":"No"}</span></td>
                        <td style={{ padding:"10px 14px" }}>
                          <button className="abtn" onClick={() => openProductForm(p)} style={{ background:"#f0c8bf", color:"#5b2d1c", marginRight:"6px" }}>Edit</button>
                          <button className="abtn" onClick={() => handleDeleteProduct(p.id)} style={{ background:"transparent", color:"#dc2626", border:"1px solid #dc2626" }}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                  {products.length === 0 && <tr><td colSpan="7" style={{ padding:"32px", textAlign:"center", color:"#bbb" }}>No products.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div>
            <h1 style={{ color:"#5b2d1c", marginBottom:"8px" }}>Inventory Management</h1>
            <p style={{ color:"#888", marginBottom:"22px", fontSize:"13px" }}>Update stock quantities. Changes apply immediately.</p>
            <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #f0c8bf", overflowX:"auto" }}>
              <table style={{ width:"100%", minWidth:"520px", borderCollapse:"collapse" }}>
                <thead><tr style={{ background:"#fff7f2", textAlign:"left" }}>
                  {["Product","Price","Current Stock","Status","Update"].map(h => <th key={h} style={{ padding:"12px 14px", fontSize:"13px" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {products.map(p => {
                    const stock = Number(p.stock_quantity ?? 0);
                    return (
                      <tr key={p.id} style={{ borderTop:"1px solid #f6e3de" }}>
                        <td style={{ padding:"12px 14px", fontWeight:700, color:"#5b2d1c" }}>{p.name}</td>
                        <td style={{ padding:"12px 14px", color:"#d96c4a", fontWeight:600 }}>\u20B1{Number(p.price).toFixed(2)}</td>
                        <td style={{ padding:"12px 14px" }}>
                          <input type="number" defaultValue={p.stock_quantity??0} id={`stock-${p.id}`} min={0} style={{ padding:"7px", width:"80px", borderRadius:"6px", border:"1px solid #f0c8bf", fontSize:"14px", textAlign:"center" }} />
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          {stock>5 ? <span style={{ color:"#166534", fontWeight:700 }}>In Stock</span> : stock>0 ? <span style={{ color:"#92400e", fontWeight:700 }}>Low Stock</span> : <span style={{ color:"#dc2626", fontWeight:700 }}>Out of Stock</span>}
                        </td>
                        <td style={{ padding:"12px 14px" }}>
                          <button className="abtn" onClick={() => handleUpdateStock(p.id, document.getElementById(`stock-${p.id}`).value)} style={{ background:"#d96c4a", color:"#fff", padding:"7px 14px" }}>Save</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "customers" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"22px", flexWrap:"wrap", gap:"12px" }}>
              <h1 style={{ color:"#5b2d1c", margin:0 }}>Customer Accounts</h1>
              <input type="text" placeholder="Search by name, email, or phone..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} style={{ padding:"8px 14px", borderRadius:"8px", border:"1px solid #f0c8bf", width:"280px", outline:"none", fontSize:"13px" }} />
            </div>
            <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #f0c8bf", overflowX:"auto" }}>
              <table style={{ width:"100%", minWidth:"720px", borderCollapse:"collapse", textAlign:"left" }}>
                <thead><tr style={{ background:"#fffaf6", color:"#5b2d1c", borderBottom:"1px solid #f0c8bf" }}>
                  {["Customer Name","Email","Contact","Address","Orders","Total Spent","Since"].map(h => <th key={h} style={{ padding:"12px 16px", fontSize:"13px" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {customers.filter(c => {
                    if (!customerSearch.trim()) return true;
                    const q = customerSearch.toLowerCase();
                    return c.full_name?.toLowerCase().includes(q)||c.fullName?.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q)||c.contact_number?.toLowerCase().includes(q);
                  }).map((c,i) => (
                    <tr key={c.id||i} style={{ borderTop:"1px solid #f6e3de" }}>
                      <td style={{ padding:"12px 16px", fontWeight:700, color:"#5b2d1c" }}>{c.full_name||c.fullName}</td>
                      <td style={{ padding:"12px 16px", color:"#666", fontSize:"13px" }}>{c.email||"N/A"}</td>
                      <td style={{ padding:"12px 16px", fontSize:"13px" }}>{c.contact_number||c.contactNumber||"N/A"}</td>
                      <td style={{ padding:"12px 16px", maxWidth:"200px", fontSize:"12px", color:"#888" }}>{c.address||"N/A"}</td>
                      <td style={{ padding:"12px 16px" }}><span style={{ background:"#fef3c7", color:"#92400e", padding:"2px 8px", borderRadius:"10px", fontWeight:700, fontSize:"12px" }}>{c.order_count||0}</span></td>
                      <td style={{ padding:"12px 16px", fontWeight:700, color:"#d96c4a" }}>\u20B1{Number(c.total_spent||0).toFixed(2)}</td>
                      <td style={{ padding:"12px 16px", fontSize:"12px", color:"#888" }}>{c.created_at?new Date(c.created_at).toLocaleDateString():"N/A"}</td>
                    </tr>
                  ))}
                  {customers.length === 0 && <tr><td colSpan="7" style={{ padding:"40px", textAlign:"center", color:"#bbb" }}>No customers yet. They appear after placing their first order or registering an account.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── Inline Confirm/Reject Modal (replaces window.confirm) ─────────── */}
      {confirmModal && (
        <div
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:"16px" }}
          onClick={(e) => { if (e.target === e.currentTarget && !actionLoading) setConfirmModal(null); }}
        >
          <div style={{ background:"#fff", padding:"28px 24px", borderRadius:"16px", width:"100%", maxWidth:"420px", boxShadow:"0 20px 50px rgba(0,0,0,.3)" }}>
            <h2 style={{ margin:"0 0 12px", color:"#5b2d1c", fontSize:"20px" }}>{confirmModal.title}</h2>
            <p style={{ margin:"0 0 18px", color:"#6b4a3d", fontSize:"14px", lineHeight:"1.6" }}>{confirmModal.message}</p>
            {confirmModal.promptLabel && (
              <div style={{ marginBottom:"18px" }}>
                <label style={{ display:"block", marginBottom:"6px", fontWeight:600, color:"#5b2d1c", fontSize:"13px" }}>{confirmModal.promptLabel}</label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Optional reason..."
                  style={{ width:"100%", padding:"9px 12px", borderRadius:"8px", border:"1px solid #f0c8bf", boxSizing:"border-box", fontSize:"14px", outline:"none" }}
                  autoFocus
                />
              </div>
            )}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmModal(null)}
                style={{ padding:"10px 18px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:600, fontSize:"14px" }}
              >
                Cancel
              </button>
              <button
                id="confirm-action-btn"
                type="button"
                disabled={actionLoading}
                onClick={() => confirmModal.onConfirm(confirmInput)}
                style={{
                  padding:"10px 20px",
                  background: confirmModal.confirmBg || "#d96c4a",
                  color: confirmModal.confirmColor || "#fff",
                  border: `1.5px solid ${confirmModal.confirmColor || "#d96c4a"}`,
                  borderRadius:"8px",
                  cursor: actionLoading ? "not-allowed" : "pointer",
                  fontWeight:700,
                  fontSize:"14px",
                  opacity: actionLoading ? 0.7 : 1,
                }}
              >
                {actionLoading ? "Processing..." : (confirmModal.confirmLabel || "Confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showProductModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"16px" }}>
          <div style={{ background:"#fff", padding:"28px 24px", borderRadius:"16px", width:"100%", maxWidth:"500px", maxHeight:"90vh", overflowY:"auto", boxSizing:"border-box" }}>
            <h2 style={{ margin:"0 0 20px", color:"#5b2d1c" }}>{editingProduct?"Edit Product":"Add Product"}</h2>
            <form onSubmit={handleProductSubmit}>
              {[{label:"Name *",key:"name",type:"text",required:true},{label:"Description",key:"description",type:"text"},{label:"Price (PHP) *",key:"price",type:"number",step:"0.01",required:true},{label:"Stock Quantity *",key:"stock_quantity",type:"number",required:true},{label:"Image URL",key:"image",type:"text"}].map(f => (
                <div key={f.key} style={{ marginBottom:"14px" }}>
                  <label style={{ display:"block", marginBottom:"6px", fontWeight:600, color:"#5b2d1c", fontSize:"13px" }}>{f.label}</label>
                  <input required={f.required} type={f.type} step={f.step} value={productForm[f.key]} onChange={e => setProductForm({...productForm,[f.key]:e.target.value})} style={{ width:"100%", padding:"9px 12px", borderRadius:"8px", border:"1px solid #f0c8bf", boxSizing:"border-box", fontSize:"14px", outline:"none" }} />
                </div>
              ))}
              <label style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"20px", fontWeight:600, color:"#5b2d1c", fontSize:"13px" }}>
                <input type="checkbox" checked={productForm.availability} onChange={e => setProductForm({...productForm,availability:e.target.checked})} />
                Available for sale
              </label>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
                <button type="button" onClick={() => setShowProductModal(false)} style={{ padding:"10px 18px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:600 }}>Cancel</button>
                <button type="submit" style={{ padding:"10px 18px", background:"#d96c4a", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:700 }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"16px" }}>
          <div style={{ background:"#fff", padding:"28px 24px", borderRadius:"16px", width:"100%", maxWidth:"420px", boxSizing:"border-box" }}>
            <h2 style={{ margin:"0 0 16px", color:"#5b2d1c", fontSize:"20px" }}>Change Admin Password</h2>
            {passwordError && (
              <div style={{ background:"#fdf2f2", color:"#b42318", padding:"10px", borderRadius:"8px", marginBottom:"16px", fontSize:"13px" }}>
                ⚠ {passwordError}
              </div>
            )}
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom:"14px" }}>
                <label style={{ display:"block", marginBottom:"6px", fontWeight:600, color:"#5b2d1c", fontSize:"13px" }}>Current Password</label>
                <input required type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} style={{ width:"100%", padding:"9px 12px", borderRadius:"8px", border:"1px solid #f0c8bf", boxSizing:"border-box", fontSize:"14px", outline:"none" }} />
              </div>
              <div style={{ marginBottom:"14px" }}>
                <label style={{ display:"block", marginBottom:"6px", fontWeight:600, color:"#5b2d1c", fontSize:"13px" }}>New Password (min 8 chars)</label>
                <input required type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} style={{ width:"100%", padding:"9px 12px", borderRadius:"8px", border:"1px solid #f0c8bf", boxSizing:"border-box", fontSize:"14px", outline:"none" }} />
              </div>
              <div style={{ marginBottom:"20px" }}>
                <label style={{ display:"block", marginBottom:"6px", fontWeight:600, color:"#5b2d1c", fontSize:"13px" }}>Confirm New Password</label>
                <input required type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} style={{ width:"100%", padding:"9px 12px", borderRadius:"8px", border:"1px solid #f0c8bf", boxSizing:"border-box", fontSize:"14px", outline:"none" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
                <button type="button" onClick={() => setShowPasswordModal(false)} style={{ padding:"10px 18px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:600 }}>Cancel</button>
                <button type="submit" disabled={passwordLoading} style={{ padding:"10px 18px", background:"#d96c4a", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:700 }}>
                  {passwordLoading ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {claimModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"16px" }}>
          <div style={{ background:"#fff", padding:"28px 24px", borderRadius:"18px", width:"100%", maxWidth:"460px", boxSizing:"border-box", boxShadow: "0 20px 40px rgba(0,0,0,.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
              <h2 style={{ margin:0, color:"#5b2d1c", fontSize:"20px" }}>📷 Verify & Complete Claim</h2>
              <button onClick={() => setClaimModal(null)} style={{ background:"transparent", border:"none", fontSize:"20px", cursor:"pointer", color:"#888" }}>&times;</button>
            </div>
            <p style={{ color:"#7a5246", fontSize:"13px", margin:"0 0 16px" }}>
              Scan the customer's Claim Card QR code with your barcode/camera scanner, or enter their <strong>Order Number</strong> / <strong>Tracking Token</strong>.
            </p>

            {claimError && (
              <div style={{ background:"#fee2e2", border:"1px solid #f87171", color:"#991b1b", padding:"10px 14px", borderRadius:"8px", marginBottom:"16px", fontSize:"13px" }}>
                ⚠ {claimError}
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!claimInput.trim()) return;
              handleVerifyClaim({ qrData: claimInput.trim(), orderNumber: claimInput.trim() });
            }}>
              <div style={{ marginBottom:"18px" }}>
                <label style={{ display:"block", marginBottom:"6px", fontWeight:700, color:"#5b2d1c", fontSize:"13px" }}>
                  QR Payload or Order Number
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. GLAZY_CLAIM:ORD-100246:... or ORD-100246"
                  value={claimInput}
                  onChange={(e) => setClaimInput(e.target.value)}
                  style={{ width:"100%", padding:"11px 14px", borderRadius:"10px", border:"1.5px solid #f0c8bf", boxSizing:"border-box", fontSize:"14px", outline:"none" }}
                />
              </div>

              <div style={{ display:"flex", justifyContent:"flex-end", gap:"10px" }}>
                <button
                  type="button"
                  onClick={() => setClaimModal(null)}
                  style={{ padding:"10px 18px", background:"#eee", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !claimInput.trim()}
                  style={{ padding:"10px 22px", background:"#166534", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontWeight:700, fontSize:"14px" }}
                >
                  {actionLoading ? "Verifying..." : "Confirm Claim & Complete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
