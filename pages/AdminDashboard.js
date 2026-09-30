import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { donuts, getDonutImage } from "../data/donuts";
import "../styles/App.css";

function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState({ stats: {}, history: [] });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Form states for Product
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    stock_quantity: "",
    availability: true,
  });

  const token = localStorage.getItem("glazy_admin_token");

  useEffect(() => {
    if (!token) {
      navigate("/admin/login");
      return;
    }
    fetchData();
  }, [navigate, token]);

  const getSampleOrders = () => [
    {
      id: 1,
      order_number: "ORD-100245",
      customer_name: "Maria Santos",
      customer_email: "maria.santos@gmail.com",
      customer_contact: "0917-555-1234",
      customer_address: "123 Mabini St, Cabuyao, Laguna",
      total_amount: 340.00,
      payment_status: "Pending Verification",
      order_status: "Pending Payment",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 2,
      order_number: "ORD-100244",
      customer_name: "Juan Dela Cruz",
      customer_email: "juan.delacruz@yahoo.com",
      customer_contact: "0918-777-8899",
      customer_address: "Block 5 Lot 12, Santa Rosa, Laguna",
      total_amount: 520.00,
      payment_status: "Verified",
      order_status: "Confirmed",
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const getSamplePayments = () => [
    {
      id: 1,
      order_id: 1,
      order_number: "ORD-100245",
      customer_name: "Maria Santos",
      customer_email: "maria.santos@gmail.com",
      amount: 340.00,
      payment_method: "GCash",
      payment_reference: "GCASH-987654321",
      status: "Pending Verification",
      order_status: "Pending Payment",
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 2,
      order_id: 2,
      order_number: "ORD-100244",
      customer_name: "Juan Dela Cruz",
      customer_email: "juan.delacruz@yahoo.com",
      amount: 520.00,
      payment_method: "Maya",
      payment_reference: "MAYA-1122334455",
      status: "Verified",
      order_status: "Confirmed",
      verified_at: new Date(Date.now() - 80000000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const getSampleCustomers = () => [
    {
      id: 1,
      full_name: "Maria Santos",
      email: "maria.santos@gmail.com",
      contact_number: "0917-555-1234",
      address: "123 Mabini St, Cabuyao, Laguna",
      order_count: 1,
      total_spent: 340.00,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 2,
      full_name: "Juan Dela Cruz",
      email: "juan.delacruz@yahoo.com",
      contact_number: "0918-777-8899",
      address: "Block 5 Lot 12, Santa Rosa, Laguna",
      order_count: 3,
      total_spent: 1450.00,
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [salesRes, productsRes, ordersRes, customersRes, paymentsRes] = await Promise.all([
        fetch("http://localhost:3001/api/sales", { headers }).catch(() => null),
        fetch("http://localhost:3001/api/products").catch(() => null),
        fetch("http://localhost:3001/api/orders", { headers }).catch(() => null),
        fetch("http://localhost:3001/api/admin/customers", { headers }).catch(() => null),
        fetch("http://localhost:3001/api/payments", { headers }).catch(() => null),
      ]);

      if (salesRes && salesRes.ok && productsRes && productsRes.ok) {
        const salesData = await salesRes.json();
        const productsData = await productsRes.json();
        const ordersData = ordersRes && ordersRes.ok ? await ordersRes.json() : [];
        const customersData = customersRes && customersRes.ok ? await customersRes.json() : [];
        const paymentsData = paymentsRes && paymentsRes.ok ? await paymentsRes.json() : [];

        setStats(salesData);
        setProducts(productsData);
        setOrders(ordersData);
        setCustomers(customersData);
        setPayments(paymentsData);
        setLoading(false);
        return;
      }
      throw new Error("Backend offline, using demo data");
    } catch (_err) {
      // Vercel / Offline Demo Mode:
      const savedProducts = JSON.parse(localStorage.getItem("glazy_products") || "null") || donuts;
      const savedOrders = JSON.parse(localStorage.getItem("glazy_orders") || "null") || getSampleOrders();
      const savedPayments = JSON.parse(localStorage.getItem("glazy_payments") || "null") || getSamplePayments();
      const savedCustomers = JSON.parse(localStorage.getItem("glazy_customers") || "null") || getSampleCustomers();

      const totalSales = savedOrders
        .filter(o => o.order_status === "Confirmed" || o.order_status === "Completed" || o.payment_status === "Verified")
        .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      setProducts(savedProducts);
      setOrders(savedOrders);
      setPayments(savedPayments);
      setCustomers(savedCustomers);
      setStats({
        stats: {
          total_sales: totalSales,
          total_orders: savedOrders.length,
          pending_verification_orders: savedPayments.filter(p => p.status === "Pending Verification").length,
          paid_orders: savedPayments.filter(p => p.status === "Verified").length,
          completed_orders: savedOrders.filter(o => o.order_status === "Completed").length,
          pending_orders: savedOrders.filter(o => o.order_status === "Pending Payment" || o.order_status === "Pending").length,
          cancelled_orders: savedOrders.filter(o => o.order_status === "Cancelled").length,
        },
        history: savedOrders,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("glazy_admin_token");
    localStorage.removeItem("glazy_admin_user");
    navigate("/admin/login");
  };

  // --- Product Management ---
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const url = editingProduct 
      ? `http://localhost:3001/api/products/${editingProduct.id}` 
      : "http://localhost:3001/api/products";
    const method = editingProduct ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productForm),
      });

      if (!res.ok) throw new Error("Failed to save product on server");
    } catch (_err) {
      // Local fallback
      let currentProducts = [...products];
      if (editingProduct) {
        currentProducts = currentProducts.map(p => p.id === editingProduct.id ? { ...p, ...productForm } : p);
      } else {
        const newP = { id: Date.now(), ...productForm, stock_quantity: Number(productForm.stock_quantity || 10) };
        currentProducts.push(newP);
      }
      setProducts(currentProducts);
      localStorage.setItem("glazy_products", JSON.stringify(currentProducts));
    }

    setShowProductModal(false);
    setEditingProduct(null);
    fetchData();
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
    try {
      await fetch(`http://localhost:3001/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (_err) {
      // Local fallback
      const updated = products.filter(p => p.id !== id);
      setProducts(updated);
      localStorage.setItem("glazy_products", JSON.stringify(updated));
    }
    fetchData();
  };

  const openProductForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({ ...product, availability: Boolean(product.availability) });
    } else {
      setEditingProduct(null);
      setProductForm({ name: "", description: "", price: "", image: "", stock_quantity: "", availability: true });
    }
    setShowProductModal(true);
  };

  // --- Inventory Management ---
  const handleUpdateStock = async (id, newStock) => {
    try {
      const res = await fetch(`http://localhost:3001/api/inventory/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stock_quantity: Number(newStock) }),
      });
      if (!res.ok) throw new Error("Failed to update stock");
    } catch (_err) {
      // Local fallback
      const updated = products.map(p => p.id === id ? { ...p, stock_quantity: Number(newStock) } : p);
      setProducts(updated);
      localStorage.setItem("glazy_products", JSON.stringify(updated));
    }
    alert("Stock updated successfully");
    fetchData();
  };

  // --- Order Management ---
  const handleUpdateOrderStatus = async (id, newStatus) => {
    try {
      const res = await fetch(`http://localhost:3001/api/orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch (_err) {
      // Local fallback
      const updated = orders.map(o => o.id === id ? { ...o, order_status: newStatus } : o);
      setOrders(updated);
      localStorage.setItem("glazy_orders", JSON.stringify(updated));
    }
    fetchData();
  };

  // --- Payment Verification ---
  const handleVerifyPayment = async (paymentId, action) => {
    const confirmMsg = action === "verify"
      ? "Verify this payment? This will confirm the order."
      : "Reject this payment? The order will remain Pending Payment.";
    if (!window.confirm(confirmMsg)) return;

    const adminNotes = action === "reject"
      ? window.prompt("Optional: Enter rejection reason (will be saved as admin note):")
      : null;

    try {
      const res = await fetch(`http://localhost:3001/api/payments/${paymentId}/verify`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, admin_notes: adminNotes || undefined }),
      });
      if (!res.ok) throw new Error("Failed to update payment");
    } catch (_err) {
      // Local fallback
      const newStatus = action === "verify" ? "Verified" : "Rejected";
      const newOrderStatus = action === "verify" ? "Confirmed" : "Pending Payment";

      const updatedPayments = payments.map(p => {
        if (p.id === paymentId) {
          return {
            ...p,
            status: newStatus,
            order_status: newOrderStatus,
            verified_at: new Date().toISOString(),
            admin_notes: adminNotes || p.admin_notes
          };
        }
        return p;
      });

      const updatedOrders = orders.map(o => {
        const matchingP = updatedPayments.find(p => p.order_id === o.id || p.order_number === o.order_number);
        if (matchingP) {
          return { ...o, payment_status: matchingP.status, order_status: matchingP.order_status };
        }
        return o;
      });

      setPayments(updatedPayments);
      setOrders(updatedOrders);
      localStorage.setItem("glazy_payments", JSON.stringify(updatedPayments));
      localStorage.setItem("glazy_orders", JSON.stringify(updatedOrders));
    }
    fetchData();
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#5b2d1c", fontSize: "16px" }}>Loading admin dashboard...</div>;

  return (
    <div className="admin-container" style={{ display: "flex", minHeight: "100vh", background: "#fffaf6", width: "100%" }}>
      <style>{`
        @media (max-width: 860px) {
          .admin-container {
            flex-direction: column !important;
          }
          .admin-sidebar {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1.5px solid #f0c8bf !important;
            padding: 14px 16px !important;
            box-sizing: border-box !important;
          }
          .admin-sidebar-header {
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            margin-bottom: 12px !important;
          }
          .admin-sidebar-header h2 {
            margin: 0 !important;
            font-size: 1.35rem !important;
            text-align: left !important;
          }
          .admin-nav-tabs {
            display: flex !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            -webkit-overflow-scrolling: touch !important;
            gap: 8px !important;
            padding-bottom: 6px !important;
            scrollbar-width: none;
          }
          .admin-nav-tabs::-webkit-scrollbar {
            display: none;
          }
          .admin-nav-tabs li {
            margin-bottom: 0 !important;
            flex-shrink: 0 !important;
          }
          .admin-nav-tabs button {
            padding: 8px 14px !important;
            font-size: 13px !important;
            border-radius: 20px !important;
            border: 1px solid #f0c8bf !important;
          }
          .admin-sidebar-footer {
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            margin-top: 10px !important;
            padding-top: 10px !important;
          }
          .admin-sidebar-footer a,
          .admin-sidebar-footer button {
            flex: 1 !important;
            padding: 8px 12px !important;
            font-size: 12px !important;
          }
          .admin-main {
            padding: 16px 12px 40px !important;
          }
          .admin-stats-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
          }
          .admin-stat-card {
            padding: 12px !important;
          }
          .admin-stat-card h3 {
            font-size: 22px !important;
          }
        }
      `}</style>

      {/* Sidebar */}
      <div className="admin-sidebar" style={{ width: "250px", background: "#fff", borderRight: "1px solid #f0c8bf", padding: "24px", flexShrink: 0 }}>
        <div className="admin-sidebar-header">
          <h2 style={{ color: "#d96c4a", marginBottom: "32px", textAlign: "center" }}>Glazy Admin</h2>
        </div>
        <ul className="admin-nav-tabs" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {["overview", "payments", "orders", "products", "inventory", "customers"].map((tab) => (
            <li key={tab} style={{ marginBottom: "12px" }}>
              <button
                onClick={() => setActiveTab(tab)}
                style={{
                  width: "100%", padding: "12px", textAlign: "left", borderRadius: "8px", border: "none",
                  background: activeTab === tab ? "#d96c4a" : "transparent",
                  color: activeTab === tab ? "#fff" : "#5b2d1c", cursor: "pointer", fontWeight: activeTab === tab ? "bold" : "normal",
                  textTransform: "capitalize",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px"
                }}
              >
                <span>
                  {tab === "payments" ? "💳 Payments" : tab === "orders" ? "📦 Orders" : tab === "overview" ? "📊 Overview" : tab === "products" ? "🍩 Products" : tab === "inventory" ? "📦 Inventory" : "👥 Customers"}
                </span>
                {tab === "payments" && payments.filter(p => p.status === "Pending Verification").length > 0 && (
                  <span style={{ fontSize: "11px", backgroundColor: activeTab === tab ? "rgba(255,255,255,0.25)" : "#fef3c7", color: activeTab === tab ? "#fff" : "#92400e", padding: "2px 7px", borderRadius: "10px", fontWeight: "700" }}>
                    {payments.filter(p => p.status === "Pending Verification").length}
                  </span>
                )}
                {tab === "customers" && customers.length > 0 && (
                  <span style={{ fontSize: "11px", backgroundColor: activeTab === tab ? "rgba(255,255,255,0.25)" : "#f0c8bf", color: activeTab === tab ? "#fff" : "#5b2d1c", padding: "2px 7px", borderRadius: "10px", fontWeight: "700" }}>
                    {customers.length}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="admin-sidebar-footer" style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #f0c8bf", display: "flex", flexDirection: "column", gap: "8px" }}>
          <Link
            to="/"
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px",
              background: "#fff",
              border: "1px solid #d96c4a",
              color: "#d96c4a",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
              fontSize: "13px"
            }}
          >
            🍩 View Storefront
          </Link>
          <button
            onClick={handleLogout}
            style={{ width: "100%", padding: "10px", background: "#f8d9d1", color: "#d96c4a", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main" style={{ flex: 1, padding: "32px", overflowY: "auto", minWidth: 0 }}>
        
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <h1 style={{ color: "#5b2d1c", marginBottom: "24px" }}>Dashboard Overview</h1>
            <div className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "32px" }}>
              {[
                ["Total Sales", `₱${Number(stats.stats?.total_sales || 0).toFixed(2)}`, "#d96c4a"],
                ["Total Orders", stats.stats?.total_orders || 0, "#5b2d1c"],
                ["⚠ Pending Verification", stats.stats?.pending_verification_orders || 0, "#92400e"],
                ["✓ Verified/Paid", stats.stats?.paid_orders || 0, "#166534"],
                ["Completed", stats.stats?.completed_orders || 0, "#1d4ed8"],
                ["Pending", stats.stats?.pending_orders || 0, "#d97706"],
                ["Cancelled", stats.stats?.cancelled_orders || 0, "#dc2626"],
              ].map(([label, value, color]) => (
                <div key={label} className="admin-stat-card" style={{ background: "#fff", borderRadius: "12px", padding: "18px", border: "1px solid #f0c8bf" }}>
                  <p style={{ margin: 0, color: "#7a5246", fontSize: "13px" }}>{label}</p>
                  <h3 style={{ margin: "8px 0 0", color: color || "#3b1f17", fontSize: "28px" }}>{value}</h3>
                </div>
              ))}
            </div>
            {/* Quick Orders View */}
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f0c8bf", overflow: "hidden" }}>
              <h2 style={{ padding: "18px 20px", margin: 0, color: "#5b2d1c", borderBottom: "1px solid #f7e5de", fontSize: "18px" }}>Recent Orders</h2>
              <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", minWidth: "480px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#fff7f2", textAlign: "left" }}>
                      <th style={{ padding: "12px 16px" }}>Order</th>
                      <th style={{ padding: "12px 16px" }}>Customer</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th style={{ padding: "12px 16px" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.history || []).slice(0, 5).map((order) => (
                      <tr key={order.id} style={{ borderTop: "1px solid #f6e3de" }}>
                        <td style={{ padding: "12px 16px" }}>{order.order_number}</td>
                        <td style={{ padding: "12px 16px" }}>{order.customer_name}</td>
                        <td style={{ padding: "12px 16px" }}>{order.order_status}</td>
                        <td style={{ padding: "12px 16px" }}>₱{Number(order.total_amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h1 style={{ color: "#5b2d1c", margin: 0 }}>Products</h1>
              <button onClick={() => openProductForm()} style={{ background: "#d96c4a", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer" }}>Add Product</button>
            </div>
            
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f0c8bf", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "600px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fff7f2", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px" }}>Image</th>
                  <th style={{ padding: "12px 16px" }}>Name</th>
                  <th style={{ padding: "12px 16px" }}>Price</th>
                  <th style={{ padding: "12px 16px" }}>Available</th>
                  <th style={{ padding: "12px 16px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderTop: "1px solid #f6e3de" }}>
                    <td style={{ padding: "12px 16px" }}><img src={p.image} alt={p.name} style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "8px" }} /></td>
                    <td style={{ padding: "12px 16px" }}>{p.name}</td>
                    <td style={{ padding: "12px 16px" }}>₱{p.price}</td>
                    <td style={{ padding: "12px 16px" }}>{p.availability ? "Yes" : "No"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <button onClick={() => openProductForm(p)} style={{ marginRight: "8px", padding: "6px 12px", cursor: "pointer", background: "#f0c8bf", border: "none", borderRadius: "4px" }}>Edit</button>
                      <button onClick={() => handleDeleteProduct(p.id)} style={{ color: "red", padding: "6px 12px", cursor: "pointer", background: "transparent", border: "1px solid red", borderRadius: "4px" }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <div>
            <h1 style={{ color: "#5b2d1c", marginBottom: "24px" }}>Inventory Management</h1>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f0c8bf", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "550px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fff7f2", textAlign: "left" }}>
                  <th style={{ padding: "12px 16px" }}>Product</th>
                  <th style={{ padding: "12px 16px" }}>Stock Quantity</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id} style={{ borderTop: "1px solid #f6e3de" }}>
                    <td style={{ padding: "12px 16px" }}>{p.name}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <input 
                        type="number" 
                        defaultValue={p.stock_quantity}
                        id={`stock-${p.id}`}
                        style={{ padding: "6px", width: "80px", borderRadius: "4px", border: "1px solid #ccc" }}
                      />
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {p.stock_quantity > 0 ? <span style={{ color: "green" }}>In Stock</span> : <span style={{ color: "red" }}>Out of Stock</span>}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <button 
                        onClick={() => handleUpdateStock(p.id, document.getElementById(`stock-${p.id}`).value)}
                        style={{ background: "#d96c4a", color: "#fff", padding: "6px 12px", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >Update</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === "payments" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <h1 style={{ color: "#5b2d1c", margin: 0 }}>💳 Payment Verification</h1>
              <div style={{ fontSize: "13px", color: "#888" }}>
                {payments.filter(p => p.status === "Pending Verification").length} payment(s) awaiting verification
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
              {[
                { label: "Pending Verification", bg: "#fef3c7", color: "#92400e" },
                { label: "Verified", bg: "#dcfce7", color: "#166534" },
                { label: "Rejected", bg: "#fee2e2", color: "#dc2626" },
              ].map(s => (
                <span key={s.label} style={{ fontSize: "11px", background: s.bg, color: s.color, padding: "3px 10px", borderRadius: "12px", fontWeight: "700" }}>{s.label}</span>
              ))}
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f0c8bf", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
                <thead>
                  <tr style={{ background: "#fff7f2", textAlign: "left" }}>
                    <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Order #</th>
                    <th style={{ padding: "12px 14px" }}>Customer</th>
                    <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Amount</th>
                    <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Method</th>
                    <th style={{ padding: "12px 14px" }}>Reference #</th>
                    <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Payment Status</th>
                    <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Order Status</th>
                    <th style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>Submitted</th>
                    <th style={{ padding: "12px 14px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr><td colSpan="9" style={{ padding: "32px", textAlign: "center", color: "#888" }}>No payments found.</td></tr>
                  )}
                  {payments.map(p => {
                    const isPending = p.status === "Pending Verification";
                    const isVerified = p.status === "Verified";
                    const isRejected = p.status === "Rejected";
                    const statusStyle = isPending
                      ? { background: "#fef3c7", color: "#92400e" }
                      : isVerified
                      ? { background: "#dcfce7", color: "#166534" }
                      : { background: "#fee2e2", color: "#dc2626" };
                    const orderStatusStyle = (p.order_status === "Confirmed" || p.order_status === "Processing")
                      ? { background: "#dcfce7", color: "#166534" }
                      : (p.order_status === "Pending Payment" || p.order_status === "Awaiting Payment Verification")
                      ? { background: "#fef3c7", color: "#92400e" }
                      : { background: "#f3f4f6", color: "#374151" };

                    return (
                      <tr key={p.id} style={{ borderTop: "1px solid #f6e3de", background: isPending ? "#fffdf5" : "#fff" }}>
                        <td style={{ padding: "12px 14px", fontWeight: "700", color: "#d96c4a", whiteSpace: "nowrap" }}>{p.order_number}</td>
                        <td style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: "600", fontSize: "13px" }}>{p.customer_name}</div>
                          <div style={{ fontSize: "11px", color: "#888" }}>{p.customer_email}</div>
                        </td>
                        <td style={{ padding: "12px 14px", fontWeight: "700", color: "#5b2d1c", whiteSpace: "nowrap" }}>₱{Number(p.amount).toFixed(2)}</td>
                        <td style={{ padding: "12px 14px" }}>{p.payment_method}</td>
                        <td style={{ padding: "12px 14px" }}>
                          {p.payment_reference
                            ? <span style={{ fontFamily: "monospace", background: "#f0f0f0", padding: "2px 6px", borderRadius: "4px", fontSize: "13px" }}>{p.payment_reference}</span>
                            : <span style={{ color: "#bbb", fontSize: "12px" }}>Not provided</span>
                          }
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ ...statusStyle, padding: "3px 10px", borderRadius: "12px", fontWeight: "700", fontSize: "12px", whiteSpace: "nowrap" }}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          <span style={{ ...orderStatusStyle, padding: "3px 10px", borderRadius: "12px", fontWeight: "600", fontSize: "11px", whiteSpace: "nowrap" }}>
                            {p.order_status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: "12px", color: "#888", whiteSpace: "nowrap" }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "12px 14px" }}>
                          {isPending ? (
                            <div style={{ display: "flex", gap: "6px", flexWrap: "nowrap" }}>
                              <button
                                id={`verify-payment-${p.id}`}
                                onClick={() => handleVerifyPayment(p.id, "verify")}
                                style={{
                                  background: "#166534", color: "#fff", border: "none",
                                  padding: "6px 12px", borderRadius: "6px", cursor: "pointer",
                                  fontWeight: "700", fontSize: "12px", whiteSpace: "nowrap"
                                }}
                              >
                                ✓ Verify
                              </button>
                              <button
                                id={`reject-payment-${p.id}`}
                                onClick={() => handleVerifyPayment(p.id, "reject")}
                                style={{
                                  background: "transparent", color: "#dc2626", border: "1px solid #dc2626",
                                  padding: "6px 10px", borderRadius: "6px", cursor: "pointer",
                                  fontWeight: "600", fontSize: "12px", whiteSpace: "nowrap"
                                }}
                              >
                                ✗ Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: "12px", color: isVerified ? "#166534" : "#dc2626" }}>
                              {isVerified ? `✓ Verified` : `✗ Rejected`}
                              {p.verified_at && <div style={{ fontSize: "10px", color: "#aaa" }}>{new Date(p.verified_at).toLocaleDateString()}</div>}
                              {p.admin_notes && <div style={{ fontSize: "10px", color: "#888", fontStyle: "italic", maxWidth: "140px" }}>{p.admin_notes}</div>}
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

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            <h1 style={{ color: "#5b2d1c", marginBottom: "24px" }}>Customer Orders</h1>
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f0c8bf", overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                <thead>
                  <tr style={{ background: "#fff7f2", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px" }}>Order No.</th>
                    <th style={{ padding: "12px 16px" }}>Customer</th>
                    <th style={{ padding: "12px 16px" }}>Total</th>
                    <th style={{ padding: "12px 16px" }}>Payment Status</th>
                    <th style={{ padding: "12px 16px" }}>Order Status</th>
                    <th style={{ padding: "12px 16px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(o => {
                    const pmtStyle = o.payment_status === "Verified"
                      ? { background: "#dcfce7", color: "#166534" }
                      : o.payment_status === "Rejected"
                      ? { background: "#fee2e2", color: "#dc2626" }
                      : o.payment_status === "Pending Verification"
                      ? { background: "#fef3c7", color: "#92400e" }
                      : { background: "#f3f4f6", color: "#374151" };

                    return (
                      <tr key={o.id} style={{ borderTop: "1px solid #f6e3de" }}>
                        <td style={{ padding: "12px 16px", fontWeight: "600", color: "#d96c4a" }}>{o.order_number}</td>
                        <td style={{ padding: "12px 16px" }}>{o.customer_name}</td>
                        <td style={{ padding: "12px 16px" }}>₱{Number(o.total_amount).toFixed(2)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ ...pmtStyle, padding: "3px 10px", borderRadius: "12px", fontWeight: "700", fontSize: "12px" }}>
                            {o.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <select
                            value={o.order_status}
                            onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                            style={{ padding: "6px", borderRadius: "4px", fontSize: "13px" }}
                          >
                            <option value="Pending Payment">Pending Payment</option>
                            <option value="Awaiting Payment Verification">Awaiting Payment Verification</option>
                            <option value="Confirmed">Confirmed</option>
                            <option value="Processing">Processing</option>
                            <option value="Preparing">Preparing</option>
                            <option value="Ready for Pickup">Ready for Pickup</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Link to={`/receipt/${o.order_number}`} target="_blank" style={{ color: "#d96c4a", textDecoration: "none", fontWeight: "bold" }}>Receipt</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === "customers" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <h1 style={{ color: "#5b2d1c", margin: 0 }}>Registered Customer Accounts</h1>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid #f0c8bf", width: "280px", outline: "none" }}
              />
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #f0c8bf", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#fffaf6", color: "#5b2d1c", borderBottom: "1px solid #f0c8bf" }}>
                    <th style={{ padding: "12px 16px" }}>Customer Name</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Contact Number</th>
                    <th style={{ padding: "12px 16px" }}>Saved Delivery Address</th>
                    <th style={{ padding: "12px 16px", textAlign: "center" }}>Orders Placed</th>
                    <th style={{ padding: "12px 16px" }}>Total Spent</th>
                    <th style={{ padding: "12px 16px" }}>Registered Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter((c) => {
                      if (!customerSearch.trim()) return true;
                      const q = customerSearch.toLowerCase();
                      return (
                        c.full_name?.toLowerCase().includes(q) ||
                        c.email?.toLowerCase().includes(q) ||
                        c.contact_number?.toLowerCase().includes(q)
                      );
                    })
                    .map((c) => (
                      <tr key={c.id} style={{ borderTop: "1px solid #f6e3de" }}>
                        <td style={{ padding: "12px 16px", fontWeight: "600", color: "#5b2d1c" }}>
                          {c.full_name}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#666" }}>{c.email}</td>
                        <td style={{ padding: "12px 16px" }}>{c.contact_number}</td>
                        <td style={{ padding: "12px 16px", maxWidth: "260px", fontSize: "13px" }}>
                          {c.address}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <span style={{ backgroundColor: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", fontSize: "12px" }}>
                            {c.order_count || 0}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", fontWeight: "600", color: "#d96c4a" }}>
                          ₱{Number(c.total_spent || 0).toFixed(2)}
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: "12px", color: "#888" }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ padding: "32px", textAlign: "center", color: "#888" }}>
                        No registered customer accounts yet. Customers can register at the top of the storefront!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Product Modal */}
      {showProductModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "16px" }}>
          <div style={{ background: "#fff", padding: "26px 22px", borderRadius: "16px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <h2>{editingProduct ? "Edit Product" : "Add Product"}</h2>
            <form onSubmit={handleProductSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px" }}>Name</label>
                <input required type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} style={{ width: "100%", padding: "8px" }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px" }}>Description</label>
                <textarea value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})} style={{ width: "100%", padding: "8px" }} />
              </div>
              <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px" }}>Price (₱)</label>
                  <input required type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} style={{ width: "100%", padding: "8px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", marginBottom: "8px" }}>Stock</label>
                  <input required type="number" value={productForm.stock_quantity} onChange={e => setProductForm({...productForm, stock_quantity: e.target.value})} style={{ width: "100%", padding: "8px" }} />
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "8px" }}>Image URL</label>
                <input type="text" value={productForm.image} onChange={e => setProductForm({...productForm, image: e.target.value})} style={{ width: "100%", padding: "8px" }} />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" checked={productForm.availability} onChange={e => setProductForm({...productForm, availability: e.target.checked})} />
                  Available for sale
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" onClick={() => setShowProductModal(false)} style={{ padding: "10px 16px", background: "#ccc", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "10px 16px", background: "#d96c4a", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" }}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
