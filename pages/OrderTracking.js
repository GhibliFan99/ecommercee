import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import QRCodeCard from "../components/QRCodeCard";
import { alertHelper } from "../components/AudioAlertHelper";
import "../styles/App.css";

const STEPS = [
  { key: "Pending", label: "Order Placed", desc: "Awaiting review" },
  { key: "Confirmed", label: "Confirmed", desc: "Payment verified" },
  { key: "Preparing", label: "Preparing", desc: "Baking fresh" },
  { key: "Ready for Pickup", label: "Ready to Claim", desc: "Ready at counter" },
  { key: "Completed", label: "Claimed", desc: "Enjoy your donuts!" },
];

function getStepIndex(status) {
  if (status === "Completed") return 4;
  if (status === "Ready for Pickup") return 3;
  if (["Preparing", "Processing"].includes(status)) return 2;
  if (status === "Confirmed") return 1;
  return 0;
}

export default function OrderTracking() {
  const { orderNumber: paramOrderNumber } = useParams();
  const navigate = useNavigate();

  const [searchRef, setSearchRef] = useState(paramOrderNumber || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(paramOrderNumber));
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Sound and alert settings
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("glazy_sound_muted") !== "true";
  });
  const [hasInteracted, setHasInteracted] = useState(false);
  const [pushPermission, setPushPermission] = useState(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });

  const previousStatusRef = useRef(null);
  const titleFlashIntervalRef = useRef(null);

  // Fetch live order tracking details
  const fetchTracking = useCallback(async (isSilent = false) => {
    const query = paramOrderNumber || searchRef;
    if (!query) return;

    if (!isSilent) setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/track/${encodeURIComponent(query.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Order not found. Please check your order reference.");
      }

      setOrder(data);
      setLastUpdated(new Date());

      // Trigger alerts if status just changed to Ready for Pickup
      const isNowReady = data.orderStatus === "Ready for Pickup";
      const wasReady = previousStatusRef.current === "Ready for Pickup";

      if (isNowReady && (!wasReady || !previousStatusRef.current)) {
        if (soundEnabled) {
          alertHelper.playReadyChime();
        }
        alertHelper.vibrate();

        // Browser push notification if permission granted
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          try {
            new Notification("Glazy - Order Ready!", {
              body: `Queue ${data.queueNumber || data.orderNumber} is ready to claim at the counter!`,
              icon: "/assets/donuts/donut-1.png",
              tag: `glazy-ready-${data.orderNumber}`,
            });
          } catch (_e) {}
        }
      }

      previousStatusRef.current = data.orderStatus;
    } catch (err) {
      if (!isSilent) setError(err.message || "Failed to load order tracking details.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [paramOrderNumber, searchRef, soundEnabled]);

  // Initial fetch and smart polling (10s active, 30s hidden tab)
  useEffect(() => {
    if (paramOrderNumber) {
      fetchTracking();
    }

    let intervalId = null;

    const setupPolling = () => {
      if (intervalId) clearInterval(intervalId);
      const delay = document.hidden ? 30000 : 10000;
      intervalId = setInterval(() => {
        fetchTracking(true);
      }, delay);
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        // Instant refresh on returning to the tab
        fetchTracking(true);
      }
      setupPolling();
    };

    setupPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchTracking, paramOrderNumber]);

  // Flashing title when order is ready and tab is in background
  useEffect(() => {
    if (order?.orderStatus === "Ready for Pickup") {
      const qNum = order.queueNumber || order.orderNumber;
      let toggle = false;

      titleFlashIntervalRef.current = setInterval(() => {
        if (document.hidden) {
          document.title = toggle ? `READY - ${qNum}!` : `CLAIM AT COUNTER!`;
          toggle = !toggle;
        } else {
          document.title = `READY - ${qNum} | Glazy Days`;
        }
      }, 1200);
    } else {
      document.title = "Order Tracking | Glazy Days";
      if (titleFlashIntervalRef.current) clearInterval(titleFlashIntervalRef.current);
    }

    return () => {
      if (titleFlashIntervalRef.current) clearInterval(titleFlashIntervalRef.current);
    };
  }, [order?.orderStatus, order?.queueNumber, order?.orderNumber]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("glazy_sound_muted", next ? "false" : "true");
    if (next) {
      alertHelper.playDing();
      setHasInteracted(true);
    }
  };

  const handleEnableAudioGesture = () => {
    alertHelper.playDing();
    setHasInteracted(true);
    setSoundEnabled(true);
    localStorage.setItem("glazy_sound_muted", "false");
  };

  const requestBrowserNotification = async () => {
    if (typeof Notification === "undefined") {
      alert("Browser notifications are not supported on this device.");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === "granted") {
        new Notification("Glazy Days Alerts Enabled", {
          body: "We will notify you the moment your order is ready for pickup!",
        });
      }
    } catch (_e) {}
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (searchRef.trim()) {
      navigate(`/track/${encodeURIComponent(searchRef.trim())}`);
      fetchTracking();
    }
  };

  const currentStepIdx = order ? getStepIndex(order.orderStatus) : 0;
  const isReady = order?.orderStatus === "Ready for Pickup";
  const isCompleted = order?.orderStatus === "Completed";

  return (
    <div style={{ minHeight: "100vh", background: "#fffaf6", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>

        {/* Top Header & Search Bar if not viewing a specific order */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <Link to="/" style={{ textDecoration: "none", color: "#d96c4a", fontWeight: "800", fontSize: "18px" }}>
            🍩 Glazy Days
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={toggleSound}
              style={{
                background: "#fff",
                border: "1.5px solid #f0c8bf",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                color: soundEnabled ? "#166534" : "#888",
                cursor: "pointer",
              }}
              title="Toggle alert chimes"
            >
              {soundEnabled ? "🔊 Sound Alerts On" : "🔇 Sound Alerts Muted"}
            </button>
            <Link
              to="/queue"
              target="_blank"
              style={{
                background: "#d96c4a",
                color: "#fff",
                borderRadius: "20px",
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              📺 Store Display Board
            </Link>
          </div>
        </div>

        {/* Search box if no param or wanting to check another order */}
        {!paramOrderNumber && (
          <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", border: "1.5px solid #f0c8bf", marginBottom: "24px", boxShadow: "0 4px 14px rgba(91,45,28,0.04)" }}>
            <h2 style={{ color: "#5b2d1c", margin: "0 0 10px", fontSize: "20px" }}>🔍 Track Your Order</h2>
            <p style={{ color: "#7a5246", margin: "0 0 16px", fontSize: "14px" }}>
              Enter your Order Number (e.g. <code>ORD-100246</code>) or Tracking Code to see real-time pickup status.
            </p>
            <form onSubmit={handleManualSearch} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Enter Order # or Tracking Code"
                value={searchRef}
                onChange={(e) => setSearchRef(e.target.value)}
                style={{ flex: 1, minWidth: "220px", padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #f0c8bf", fontSize: "15px", outline: "none" }}
              />
              <button
                type="submit"
                style={{ background: "#d96c4a", color: "#fff", padding: "12px 24px", border: "none", borderRadius: "10px", fontWeight: "700", fontSize: "15px", cursor: "pointer" }}
              >
                Track Order
              </button>
            </form>
          </div>
        )}

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#5b2d1c" }}>
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>🍩</div>
            <div style={{ fontWeight: 600 }}>Checking live order status...</div>
          </div>
        )}

        {error && (
          <div style={{ background: "#fee2e2", border: "1.5px solid #f87171", borderRadius: "12px", padding: "16px 20px", color: "#991b1b", marginBottom: "24px" }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Active Order Details */}
        {order && !loading && (
          <>
            {/* 1. Full-Width Animated Highlight Banner when Ready to Claim */}
            {isReady && (
              <div
                style={{
                  background: "linear-gradient(135deg, #15803d, #16a34a)",
                  color: "#fff",
                  borderRadius: "16px",
                  padding: "24px",
                  marginBottom: "24px",
                  boxShadow: "0 10px 30px rgba(22, 163, 74, 0.35)",
                  border: "2px solid #86efac",
                  animation: "readyPulse 2s infinite ease-in-out",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 800, color: "#dcfce7", marginBottom: "6px" }}>
                  🔔 ORDER READY FOR PICKUP!
                </div>
                <div style={{ fontSize: "48px", fontWeight: 900, letterSpacing: "2px", margin: "8px 0" }}>
                  {order.queueNumber || "A-001"}
                </div>
                <h3 style={{ fontSize: "20px", margin: "6px 0", fontWeight: 700 }}>
                  Ready na po ang order mo! Puwede mo nang kunin sa counter.
                </h3>
                <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#bbf7d0" }}>
                  Please present the claim card or QR code below to the cashier to claim your donuts.
                </p>
              </div>
            )}

            {/* Gesture banner to activate Audio if not yet permitted */}
            {!hasInteracted && soundEnabled && (
              <div
                style={{
                  background: "#fffbea",
                  border: "1.5px solid #fcd34d",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "13px", color: "#92400e" }}>
                  🔊 <strong>Audio Alerts Ready:</strong> Tap enable so your browser chimes when ready!
                </div>
                <button
                  onClick={handleEnableAudioGesture}
                  style={{
                    background: "#d97706",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Enable Sound Alerts
                </button>
              </div>
            )}

            {/* Browser Push Permission Banner */}
            {pushPermission === "default" && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1.5px solid #bfdbfe",
                  borderRadius: "12px",
                  padding: "12px 18px",
                  marginBottom: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ fontSize: "13px", color: "#1e40af" }}>
                  📲 <strong>Stay Notified:</strong> Receive a browser push alert even if you browse other tabs.
                </div>
                <button
                  onClick={requestBrowserNotification}
                  style={{
                    background: "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Notify me when ready
                </button>
              </div>
            )}

            {/* Main Status & Progress Card */}
            <div
              style={{
                background: "#fff",
                borderRadius: "18px",
                padding: "28px",
                border: "1.5px solid #f0c8bf",
                boxShadow: "0 10px 28px rgba(91, 45, 28, 0.05)",
                marginBottom: "24px",
              }}
            >
              {/* Header details */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #fce8e3", paddingBottom: "18px", marginBottom: "22px" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", fontWeight: 700 }}>
                    Order Number
                  </div>
                  <div style={{ fontSize: "20px", fontWeight: 800, color: "#5b2d1c" }}>
                    {order.orderNumber}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", color: "#888", textTransform: "uppercase", fontWeight: 700 }}>
                    Queue Number
                  </div>
                  <div style={{ fontSize: "32px", fontWeight: 900, color: "#d96c4a", lineHeight: 1.1 }}>
                    {order.queueNumber || "A-001"}
                  </div>
                </div>
              </div>

              {/* Progress Steps Timeline */}
              <div style={{ margin: "24px 0 32px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: "16px" }}>
                  {/* Connecting bar */}
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      left: "5%",
                      right: "5%",
                      height: "4px",
                      background: "#f3e1db",
                      zIndex: 1,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      left: "5%",
                      width: `${(currentStepIdx / (STEPS.length - 1)) * 90}%`,
                      height: "4px",
                      background: isReady ? "#16a34a" : "#d96c4a",
                      zIndex: 2,
                      transition: "width 0.4s ease",
                    }}
                  />

                  {STEPS.map((step, idx) => {
                    const isDone = idx <= currentStepIdx;
                    const isCurrent = idx === currentStepIdx;
                    return (
                      <div key={step.key} style={{ zIndex: 3, textAlign: "center", flex: 1 }}>
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "50%",
                            background: isCurrent ? (isReady ? "#16a34a" : "#d96c4a") : isDone ? "#dcfce7" : "#fff",
                            color: isCurrent ? "#fff" : isDone ? "#166534" : "#888",
                            border: `2.5px solid ${isCurrent ? (isReady ? "#16a34a" : "#d96c4a") : isDone ? "#86efac" : "#e5e7eb"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 8px",
                            fontWeight: 800,
                            fontSize: "13px",
                            boxShadow: isCurrent ? "0 4px 10px rgba(217,108,74,0.3)" : "none",
                          }}
                        >
                          {isDone && !isCurrent ? "✓" : idx + 1}
                        </div>
                        <div style={{ fontSize: "12px", fontWeight: isCurrent ? 800 : 600, color: isCurrent ? "#5b2d1c" : "#888" }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: "10px", color: "#aaa", marginTop: "2px" }}>
                          {step.desc}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status info box */}
              <div
                style={{
                  background: isReady ? "#f0fdf4" : isCompleted ? "#f8fafc" : "#fffaf6",
                  border: `1.5px solid ${isReady ? "#bbf7d0" : "#f0c8bf"}`,
                  borderRadius: "12px",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", color: "#888", fontWeight: 600 }}>Current Status</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: isReady ? "#166534" : "#5b2d1c" }}>
                    {order.orderStatus}
                  </div>
                  {order.pickupDate && (
                    <div style={{ fontSize: "12px", color: "#7a5246", marginTop: "4px" }}>
                      📅 Pickup Time: <strong>{order.pickupDate} {order.pickupTime ? `(${order.pickupTime})` : ""}</strong>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "right", fontSize: "12px", color: "#888" }}>
                  <div>Payment: <strong style={{ color: order.paymentStatus === "Verified" ? "#166534" : "#92400e" }}>{order.paymentStatus}</strong></div>
                  {lastUpdated && <div>Updated: {lastUpdated.toLocaleTimeString()}</div>}
                </div>
              </div>
            </div>

            {/* 2. Show This Screen to Cashier Claim Card */}
            <div
              style={{
                background: "#fff",
                borderRadius: "18px",
                padding: "28px",
                border: "2px dashed #d96c4a",
                boxShadow: "0 10px 28px rgba(91, 45, 28, 0.05)",
                textAlign: "center",
                marginBottom: "24px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#d96c4a", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>
                🏷️ PRESENT TO CASHIER UPON CLAIMING
              </div>
              <h2 style={{ color: "#5b2d1c", fontSize: "24px", margin: "0 0 16px" }}>
                Claim Verification Card
              </h2>

              <div style={{ display: "inline-block", padding: "12px 24px", background: "#fff5f0", borderRadius: "12px", border: "1px solid #f8d9d1", marginBottom: "20px" }}>
                <span style={{ fontSize: "12px", color: "#7a5246", display: "block" }}>YOUR QUEUE NUMBER</span>
                <span style={{ fontSize: "40px", fontWeight: 900, color: "#d96c4a", letterSpacing: "1px" }}>
                  {order.queueNumber || "A-001"}
                </span>
              </div>

              {/* QR Code */}
              <div style={{ margin: "10px 0 20px" }}>
                <QRCodeCard value={order.qrData || `GLAZY_CLAIM:${order.orderNumber}:${order.trackingToken}`} size={190} />
                <div style={{ fontSize: "12px", color: "#888", marginTop: "8px" }}>
                  Cashier will scan this QR code or enter Order #{order.orderNumber} to verify your claim.
                </div>
              </div>

              {/* Items summary */}
              {order.items && order.items.length > 0 && (
                <div style={{ textAlign: "left", background: "#fffaf6", padding: "16px", borderRadius: "12px", border: "1px solid #f0c8bf", marginTop: "16px" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#5b2d1c", marginBottom: "8px" }}>
                    Items in this Order ({order.items.length})
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "13px", color: "#6b4a3d" }}>
                    {order.items.map((item, idx) => (
                      <li key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: idx !== order.items.length - 1 ? "1px solid #fce8e3" : "none" }}>
                        <span>{item.name} <strong>x{item.quantity}</strong></span>
                        <span style={{ fontWeight: 600 }}>₱{Number(item.subtotal || item.unit_price * item.quantity || 0).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                  <div style={{ textAlign: "right", marginTop: "10px", fontWeight: 800, color: "#d96c4a", fontSize: "15px" }}>
                    Total: ₱{Number(order.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            {/* Back to storefront / Print receipt button */}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
              <Link
                to={`/receipt/${order.orderNumber}`}
                style={{
                  padding: "12px 20px",
                  background: "#fff",
                  color: "#d96c4a",
                  border: "1.5px solid #d96c4a",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                📄 View Full Receipt
              </Link>
              <Link
                to="/"
                style={{
                  padding: "12px 20px",
                  background: "#d96c4a",
                  color: "#fff",
                  borderRadius: "10px",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                🍩 Order More Donuts
              </Link>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes readyPulse {
          0% { transform: scale(1); box-shadow: 0 10px 25px rgba(22, 163, 74, 0.3); }
          50% { transform: scale(1.015); box-shadow: 0 14px 35px rgba(22, 163, 74, 0.5); }
          100% { transform: scale(1); box-shadow: 0 10px 25px rgba(22, 163, 74, 0.3); }
        }
      `}</style>
    </div>
  );
}
