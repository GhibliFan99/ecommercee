import React, { useEffect, useState, useRef } from "react";
import { alertHelper } from "../components/AudioAlertHelper";
import "../styles/App.css";

export default function QueueBoard() {
  const [data, setData] = useState({ ready: [], preparing: [] });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  const prevReadyIdsRef = useRef(new Set());

  const fetchQueue = async (isInitial = false) => {
    try {
      const res = await fetch("/api/queue");
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());

      const currentIds = new Set(json.ready.map((r) => r.id));

      if (!isInitial) {
        // Detect newly ready queue numbers
        const newlyAdded = json.ready.filter((r) => !prevReadyIdsRef.current.has(r.id));
        if (newlyAdded.length > 0) {
          if (soundEnabled) {
            alertHelper.playDing();
          }
          if (ttsEnabled) {
            alertHelper.speakQueueAnnouncement(newlyAdded[0].queue_number, 1);
          }
        }
      }

      prevReadyIdsRef.current = currentIds;
    } catch (err) {
      console.warn("Queue board poll error:", err);
    }
  };

  useEffect(() => {
    fetchQueue(true);
    // Polling every 10 seconds for real-time board updates
    const interval = setInterval(() => {
      fetchQueue(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [soundEnabled, ttsEnabled]);

  const handleEnableAudio = () => {
    alertHelper.playDing();
    setHasInteracted(true);
    setSoundEnabled(true);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at top, #2d150e, #140905)",
        color: "#fff",
        fontFamily: "'Segoe UI', Roboto, sans-serif",
        padding: "24px 32px 60px",
        boxSizing: "border-box",
      }}
    >
      {/* Board Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "2px solid rgba(240, 200, 191, 0.2)",
          paddingBottom: "16px",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span style={{ fontSize: "36px" }}>🍩</span>
          <div>
            <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, letterSpacing: "1px", color: "#f8d9d1" }}>
              GLAZY DAYS
            </h1>
            <div style={{ fontSize: "14px", color: "#d96c4a", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>
              Now Serving Board
            </div>
          </div>
        </div>

        {/* Board Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {!hasInteracted && (
            <button
              onClick={handleEnableAudio}
              style={{
                background: "#d96c4a",
                color: "#fff",
                border: "none",
                borderRadius: "20px",
                padding: "8px 18px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 0 15px rgba(217, 108, 74, 0.6)",
              }}
            >
              🔊 Tap Once to Enable Board Audio
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: soundEnabled ? "rgba(22, 163, 74, 0.25)" : "rgba(255, 255, 255, 0.1)",
              border: `1.5px solid ${soundEnabled ? "#22c55e" : "#666"}`,
              color: soundEnabled ? "#86efac" : "#bbb",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {soundEnabled ? "🔔 Ding Chime: ON" : "🔕 Ding Chime: OFF"}
          </button>

          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            style={{
              background: ttsEnabled ? "rgba(217, 108, 74, 0.25)" : "rgba(255, 255, 255, 0.1)",
              border: `1.5px solid ${ttsEnabled ? "#d96c4a" : "#666"}`,
              color: ttsEnabled ? "#f8d9d1" : "#bbb",
              borderRadius: "20px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {ttsEnabled ? "🗣️ Voice Announce: ON" : "🔇 Voice Announce: OFF"}
          </button>

          {lastUpdated && (
            <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)" }}>
              Synced {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Main Two-Column Board Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "28px",
        }}
      >
        {/* Column 1: READY FOR PICKUP */}
        <div
          style={{
            background: "rgba(34, 197, 94, 0.08)",
            borderRadius: "24px",
            border: "2px solid rgba(34, 197, 94, 0.3)",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "2px solid rgba(34, 197, 94, 0.3)",
              paddingBottom: "14px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 12px #22c55e" }} />
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 900, color: "#4ade80", letterSpacing: "1.5px" }}>
                READY FOR PICKUP
              </h2>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#86efac", background: "rgba(34, 197, 94, 0.2)", padding: "4px 14px", borderRadius: "14px" }}>
              {data.ready.length}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "18px",
            }}
          >
            {data.ready.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  background: idx === 0 ? "linear-gradient(135deg, #15803d, #16a34a)" : "rgba(22, 101, 52, 0.3)",
                  border: `2px solid ${idx === 0 ? "#86efac" : "rgba(74, 222, 128, 0.4)"}`,
                  borderRadius: "18px",
                  padding: "20px 14px",
                  textAlign: "center",
                  boxShadow: idx === 0 ? "0 0 30px rgba(74, 222, 128, 0.4)" : "0 4px 14px rgba(0,0,0,0.2)",
                  transform: idx === 0 ? "scale(1.03)" : "none",
                  transition: "all 0.3s ease",
                }}
              >
                <div style={{ fontSize: "40px", fontWeight: 900, letterSpacing: "2px", color: "#fff", lineHeight: 1 }}>
                  {item.queue_number}
                </div>
                {idx === 0 && (
                  <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#dcfce7", marginTop: "8px" }}>
                    ⭐ Just Called!
                  </div>
                )}
              </div>
            ))}

            {data.ready.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.4)", fontSize: "16px" }}>
                No ready orders at the counter right now.
              </div>
            )}
          </div>
        </div>

        {/* Column 2: PREPARING */}
        <div
          style={{
            background: "rgba(217, 108, 74, 0.08)",
            borderRadius: "24px",
            border: "2px solid rgba(217, 108, 74, 0.25)",
            padding: "24px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "2px solid rgba(217, 108, 74, 0.25)",
              paddingBottom: "14px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#f97316", boxShadow: "0 0 12px #f97316" }} />
              <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 900, color: "#fb923c", letterSpacing: "1.5px" }}>
                PREPARING
              </h2>
            </div>
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#fdba74", background: "rgba(249, 115, 22, 0.2)", padding: "4px 14px", borderRadius: "14px" }}>
              {data.preparing.length}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "14px",
            }}
          >
            {data.preparing.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "rgba(124, 45, 18, 0.25)",
                  border: "1.5px solid rgba(251, 146, 60, 0.3)",
                  borderRadius: "14px",
                  padding: "16px 10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px", fontWeight: 800, color: "#fed7aa", letterSpacing: "1px" }}>
                  {item.queue_number}
                </div>
              </div>
            ))}

            {data.preparing.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.4)", fontSize: "16px" }}>
                All current orders are ready or claimed!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
