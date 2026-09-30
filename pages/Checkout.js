import React, { useState, useEffect } from "react";
import "../styles/Checkout.css";
import Footer from "../components/Footer";
import { useNavigate } from "react-router-dom";
import { useCustomer } from "../components/CustomerContext";
import gcashQR from "../assets/gcash-qr.jpg";
import mayaQR from "../assets/maya-qr.jpg";

const PAYMENT_METHODS = [
  {
    id: "GCash",
    label: "GCash",
    color: "#0068ff",
    bg: "#e8f0ff",
    border: "#b3cfff",
    qr: gcashQR,
    number: "0917-123-4567",
    account: "Glazy Days Donuts",
    instructions: "Open your GCash app → Scan QR or send to the number below → Enter your exact order total → Screenshot your receipt.",
  },
  {
    id: "Maya",
    label: "Maya",
    color: "#00b14f",
    bg: "#e6f8ef",
    border: "#a3e5c0",
    qr: mayaQR,
    number: "0917-123-4567",
    account: "Glazy Days Donuts",
    instructions: "Open your Maya app → Scan QR or send to the number below → Enter your exact order total → Screenshot your receipt.",
  },
];

function Checkout({ cart, clearCart }) {
  const { customer: loggedInCustomer, isLoggedIn, openAccountModal } = useCustomer();
  const [paymentMethod, setPaymentMethod] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState({
    fullName: "",
    address: "",
    contactNumber: "",
    email: "",
  });

  useEffect(() => {
    if (loggedInCustomer) {
      setCustomer({
        fullName: loggedInCustomer.full_name || loggedInCustomer.fullName || "",
        address: loggedInCustomer.address || "",
        contactNumber: loggedInCustomer.contact_number || loggedInCustomer.contactNumber || "",
        email: loggedInCustomer.email || "",
      });
    }
  }, [loggedInCustomer]);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderId, setOrderId] = useState(null);
  const [orderPaymentStatus, setOrderPaymentStatus] = useState("");
  const navigate = useNavigate();

  const totalPrice = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const selectedPayment = PAYMENT_METHODS.find((p) => p.id === paymentMethod);

  // Min pickup date = tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomer((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleConfirmOrder = async () => {
    setError("");

    if (!customer.fullName.trim() || !customer.address.trim() || !customer.contactNumber.trim()) {
      setError("Please fill in all required customer details.");
      return;
    }
    if (!pickupDate || !pickupTime) {
      setError("Please select a pickup date and time.");
      return;
    }
    if (!paymentMethod) {
      setError("Please select a payment method.");
      return;
    }
    if (!referenceNumber.trim()) {
      setError(`Please enter your ${paymentMethod} reference number to confirm payment.`);
      return;
    }
    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customer: {
          fullName: customer.fullName,
          address: customer.address,
          contactNumber: customer.contactNumber,
          email: customer.email || "",
          id: loggedInCustomer?.id || null,
        },
        customerId: loggedInCustomer?.id || null,
        paymentMethod,
        paymentReference: referenceNumber.trim() || null,
        pickupDate,
        pickupTime,
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      };

      const response = await fetch("http://localhost:3001/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to place your order.");
      }

      setIsConfirmed(true);
      setOrderNumber(data.order.order_number);
      setOrderId(data.order.id);
      setOrderPaymentStatus(data.order.payment_status);
      clearCart();
    } catch (err) {
      setError(err.message || "Unable to place your order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isConfirmed) {
    return (
      <div className="checkout-page">
        <div className="order-confirmed">
          <div style={{ fontSize: "60px", marginBottom: "16px" }}>📋</div>
          <h2 style={{ color: "#d96c4a" }}>Order Placed!</h2>
          <p>Thank you, <strong>{customer.fullName}</strong>! Your order has been received.</p>

          {/* Payment Verification Notice */}
          <div style={{
            background: "#fffbea",
            border: "1.5px solid #f6c90e",
            borderRadius: "14px",
            padding: "18px 22px",
            margin: "18px auto",
            maxWidth: "460px",
            textAlign: "left",
          }}>
            <div style={{ fontWeight: "700", color: "#92710a", marginBottom: "8px", fontSize: "15px" }}>
              ⏳ Awaiting Payment Verification
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "#7a5c0a", lineHeight: "1.6" }}>
              Your order is <strong>Pending Payment</strong>. Our team will review your payment
              {referenceNumber ? ` (Ref: ${referenceNumber})` : ""} and confirm your order once it has been verified.
              You will be notified when your payment is <strong>Verified</strong> and your order is <strong>Confirmed</strong>.
            </p>
          </div>

          {/* Flow Steps */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "6px",
            flexWrap: "wrap",
            margin: "16px 0",
            fontSize: "12px",
          }}>
            {[
              { label: "Order Placed", done: true },
              { label: "Pending Payment", done: true, active: true },
              { label: "Payment Verification", done: false },
              { label: "Order Confirmed", done: false },
            ].map((step, i) => (
              <React.Fragment key={step.label}>
                <div style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  background: step.active ? "#fef3c7" : step.done ? "#dcfce7" : "#f3f4f6",
                  color: step.active ? "#92710a" : step.done ? "#166534" : "#9ca3af",
                  fontWeight: step.active || step.done ? "700" : "400",
                  border: step.active ? "1px solid #f6c90e" : step.done ? "1px solid #bbf7d0" : "1px solid #e5e7eb",
                }}>
                  {step.done && !step.active ? "✓ " : ""}{step.label}
                </div>
                {i < 3 && <span style={{ color: "#ccc" }}>›</span>}
              </React.Fragment>
            ))}
          </div>

          <p style={{ color: "#888", fontSize: "13px", margin: "8px 0 20px" }}>Have a <span className="brand-name">Glazy Day!</span></p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "8px" }}>
            <button
              onClick={() => navigate(`/receipt/${orderNumber}`)}
              style={{ padding: "12px 24px", background: "#d96c4a", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}
            >
              📄 View Order Details
            </button>
            <button
              onClick={() => navigate("/")}
              style={{ padding: "12px 24px", background: "#fff", color: "#d96c4a", border: "2px solid #d96c4a", borderRadius: "8px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}
            >
              🍩 Continue Shopping
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <main className="checkout-container">
        <h1 className="checkout-title">Checkout</h1>

        {/* Customer Info */}
        <section className="customer-info">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
            <h2 style={{ margin: 0 }}>📋 Customer Details</h2>
            {isLoggedIn && (
              <span style={{ fontSize: "12px", color: "#166534", backgroundColor: "#dcfce7", padding: "4px 10px", borderRadius: "14px", fontWeight: "600" }}>
                ✓ Auto-filled from your account
              </span>
            )}
          </div>

          {/* Account Fast Checkout Notice */}
          {isLoggedIn ? (
            <div
              style={{
                backgroundColor: "#fff0f3",
                border: "1.5px solid #ffccd7",
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontWeight: "700", color: "#CD2C58", fontSize: "13px" }}>
                  👋 Hi, {loggedInCustomer.full_name}!
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  Your delivery contact and address details are loaded. You can edit them below if needed.
                </div>
              </div>
              <button
                type="button"
                onClick={() => openAccountModal("profile")}
                style={{
                  background: "#CD2C58",
                  color: "#fff",
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Edit Saved Details
              </button>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#fffaf6",
                border: "1.5px solid #f0c8bf",
                borderRadius: "12px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ fontWeight: "700", color: "#d96c4a", fontSize: "13px" }}>
                  🍩 Want faster checkout next time?
                </div>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  Register your account to save your delivery details and track past orders.
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => openAccountModal("register")}
                  style={{
                    background: "#CD2C58",
                    color: "#fff",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  📝 Register
                </button>
                <button
                  type="button"
                  onClick={() => openAccountModal("login")}
                  style={{
                    background: "#fff",
                    color: "#CD2C58",
                    border: "1px solid #CD2C58",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Sign In
                </button>
              </div>
            </div>
          )}

          <form>
            <label>
              Full Name <span style={{ color: "#d96c4a" }}>*</span>
              <input
                type="text"
                name="fullName"
                value={customer.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
              />
            </label>
            <label>
              Address <span style={{ color: "#d96c4a" }}>*</span>
              <input
                type="text"
                name="address"
                value={customer.address}
                onChange={handleChange}
                placeholder="Enter your complete address"
              />
            </label>
            <label>
              Contact Number <span style={{ color: "#d96c4a" }}>*</span>
              <input
                type="tel"
                name="contactNumber"
                value={customer.contactNumber}
                onChange={handleChange}
                placeholder="e.g. 09XX-XXX-XXXX"
              />
            </label>
            <label>
              Email <span style={{ color: "#aaa", fontSize: "12px" }}>(optional)</span>
              <input
                type="email"
                name="email"
                value={customer.email}
                onChange={handleChange}
                placeholder="Enter your email (optional)"
              />
            </label>
          </form>
        </section>

        {/* Pickup Details */}
        <section className="customer-info">
          <h2>🕐 Pickup Details</h2>
          <form>
            <label>
              Pickup Date <span style={{ color: "#d96c4a" }}>*</span>
              <input
                type="date"
                value={pickupDate}
                min={minDate}
                onChange={(e) => { setPickupDate(e.target.value); setError(""); }}
              />
            </label>
            <label>
              Pickup Time <span style={{ color: "#d96c4a" }}>*</span>
              <input
                type="time"
                value={pickupTime}
                onChange={(e) => { setPickupTime(e.target.value); setError(""); }}
              />
            </label>
          </form>
          <p style={{ fontSize: "13px", color: "#888", marginTop: "8px" }}>
            📍 Pickup location: <strong>Glazy Days, Cabuyao City, Laguna</strong>
          </p>
        </section>

        {/* Order Summary */}
        <section className="order-summary">
          <h2>🛒 Order Summary</h2>
          {cart.length > 0 ? (
            <>
              <ul>
                {cart.map((item) => (
                  <li key={item.id}>
                    <span>{item.name} x {item.quantity}</span>
                    <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <div style={{ borderTop: "2px dashed #f0c8bf", marginTop: "12px", paddingTop: "12px" }}>
                <h3 style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Total:</span>
                  <span style={{ color: "#d96c4a" }}>₱{totalPrice.toFixed(2)}</span>
                </h3>
              </div>
            </>
          ) : (
            <p>Your cart is empty.</p>
          )}
        </section>

        {/* Payment Method */}
        <section className="payment-method">
          <h2>💳 Payment Method</h2>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px" }}>
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => { setPaymentMethod(pm.id); setReferenceNumber(""); setError(""); }}
                style={{
                  padding: "12px 20px",
                  borderRadius: "12px",
                  border: `2px solid ${paymentMethod === pm.id ? pm.color : "#f0c8bf"}`,
                  background: paymentMethod === pm.id ? pm.bg : "#fff",
                  color: paymentMethod === pm.id ? pm.color : "#5b2d1c",
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontSize: "15px",
                  transition: "all 0.2s",
                  boxShadow: paymentMethod === pm.id ? `0 2px 12px ${pm.border}` : "none",
                }}
              >
                {pm.id === "GCash" && "📱 "}
                {pm.id === "Maya" && "💚 "}
                {pm.label}
              </button>
            ))}
          </div>

          {/* QR / Payment Details */}
          {selectedPayment && (
            <div style={{
              background: selectedPayment.bg,
              border: `1.5px solid ${selectedPayment.border}`,
              borderRadius: "16px",
              padding: "20px",
              textAlign: "center",
              animation: "fadeUp 0.3s ease"
            }}>
              <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`}</style>

              <p style={{ color: selectedPayment.color, fontWeight: "bold", marginBottom: "12px", fontSize: "16px" }}>
                Scan QR to Pay via {selectedPayment.label}
              </p>
              <img
                src={selectedPayment.qr}
                alt={`${selectedPayment.label} QR Code`}
                style={{ width: "200px", height: "auto", borderRadius: "12px", border: `2px solid ${selectedPayment.border}`, marginBottom: "12px" }}
              />
              <p style={{ fontSize: "14px", color: "#5b2d1c", marginBottom: "4px" }}>
                <strong>{selectedPayment.label} Number:</strong> {selectedPayment.number}
              </p>
              <p style={{ fontSize: "14px", color: "#5b2d1c", marginBottom: "12px" }}>
                <strong>Account Name:</strong> {selectedPayment.account}
              </p>
              <p style={{ fontSize: "13px", color: "#7a5246", marginBottom: "16px" }}>
                {selectedPayment.instructions}
              </p>
              <p style={{ fontSize: "13px", fontWeight: "bold", color: "#d96c4a", marginBottom: "4px" }}>
                Amount to send: ₱{totalPrice.toFixed(2)}
              </p>
              <label style={{ display: "block", textAlign: "left", marginTop: "12px" }}>
                <span style={{ fontWeight: "bold", color: "#5b2d1c", fontSize: "14px" }}>
                  Reference / Transaction Number <span style={{ color: "#d96c4a" }}>*</span>
                </span>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => { setReferenceNumber(e.target.value); setError(""); }}
                  placeholder={`Enter your ${selectedPayment.label} reference number`}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: `1.5px solid ${selectedPayment.border}`,
                    boxSizing: "border-box",
                    marginTop: "6px",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />
                <p style={{ margin: "6px 0 0", fontSize: "11px", color: "#9a6d5a", lineHeight: "1.5" }}>
                  ℹ️ Your reference number is stored as supporting information only. Your order will be confirmed <strong>after our team verifies your payment</strong>.
                </p>
              </label>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <div style={{ background: "#fdf2f2", color: "#b42318", padding: "12px 16px", borderRadius: "8px", border: "1px solid #f8d0d0", marginBottom: "12px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            ⚠ {error}
          </div>
        )}

        {/* Actions */}
        <div className="checkout-actions">
          <button
            className="confirm-btn"
            onClick={handleConfirmOrder}
            disabled={cart.length === 0 || loading}
          >
            {loading ? "Placing Order..." : "✅ Confirm Order"}
          </button>
          <button className="cancel-btn" onClick={() => navigate("/cart")}>
            Cancel
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Checkout;
