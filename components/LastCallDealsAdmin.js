import React, { useState, useEffect, useCallback } from "react";
import { getDonutImage } from "../data/donuts";

export default function LastCallDealsAdmin({ token, onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [filterEligible, setFilterEligible] = useState("all"); // 'all' | 'eligible' | 'active'
  const [settingsForm, setSettingsForm] = useState({
    enabled: true,
    startTime: "18:00",
    endTime: "23:59",
    minStock: 5,
    minDiscount: 15,
    maxDiscount: 35,
    maxDailySales: 2,
    excludedProductIds: [],
    manualOverride: "auto",
  });

  const notify = (msg) => {
    if (onToast) onToast(msg);
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch("/api/admin/last-call/settings", { headers, credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch Last Call settings");
      const json = await res.json();
      setData(json);
      if (json.settings) {
        setSettingsForm({
          enabled: json.settings.enabled ?? true,
          startTime: json.settings.startTime || "18:00",
          endTime: json.settings.endTime || "23:59",
          minStock: json.settings.minStock ?? 5,
          minDiscount: json.settings.minDiscount ?? 15,
          maxDiscount: json.settings.maxDiscount ?? 35,
          maxDailySales: json.settings.maxDailySales ?? 2,
          excludedProductIds: json.settings.excludedProductIds || [],
          manualOverride: json.settings.manualOverride || "auto",
        });
      }
    } catch (err) {
      console.error("Last Call fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggleOverride = async (mode) => {
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch("/api/admin/last-call/toggle-override", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ mode }),
      });
      if (!res.ok) throw new Error("Failed to update mode");
      const json = await res.json();
      setData(json);
      setSettingsForm((prev) => ({ ...prev, manualOverride: mode }));
      notify(
        mode === "force_on"
          ? "⚡ Last Call Deals forced ACTIVE (Test Mode)"
          : mode === "force_off"
          ? "🔒 Last Call Deals forced OFF"
          : "⏰ Last Call Deals restored to automatic schedule"
      );
    } catch (err) {
      notify("Failed to change mode: " + err.message);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch("/api/admin/last-call/settings", {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify(settingsForm),
      });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to update rules");
      }
      const json = await res.json();
      setData(json);
      notify("✓ Last Call Deal rules successfully saved!");
      setShowConfig(false);
    } catch (err) {
      notify("Error saving rules: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleProductExclusion = (prodId) => {
    setSettingsForm((prev) => {
      const exists = prev.excludedProductIds.includes(prodId);
      const next = exists
        ? prev.excludedProductIds.filter((id) => id !== prodId)
        : [...prev.excludedProductIds, prodId];
      return { ...prev, excludedProductIds: next };
    });
  };

  const windowStatus = data?.windowStatus || { active: false, reason: "Loading..." };
  const activeDeals = data?.activeDeals || [];
  const allProducts = data?.allProducts || [];

  const displayProducts = allProducts.filter((p) => {
    if (filterEligible === "active") return p.isDealActive;
    if (filterEligible === "eligible") return p.isEligible;
    return true;
  });

  return (
    <div
      className="lastcall-container"
      style={{
        background: "#ffffff",
        borderRadius: "16px",
        border: "1px solid #f0c8bf",
        padding: "24px",
        boxShadow: "0 4px 20px rgba(91, 45, 28, 0.04)",
        marginBottom: "28px",
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "20px",
          borderBottom: "1px solid #f9ede8",
          paddingBottom: "18px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "24px" }}>🔥</span>
            <h2 style={{ margin: 0, color: "#5b2d1c", fontSize: "20px", fontWeight: 800 }}>
              Last Call Deals Engine
            </h2>
            <span
              style={{
                fontSize: "11px",
                padding: "3px 10px",
                borderRadius: "12px",
                fontWeight: 800,
                background: windowStatus.active ? "#dcfce7" : "#fef3c7",
                color: windowStatus.active ? "#166534" : "#92400e",
                border: windowStatus.active ? "1px solid #bbf7d0" : "1px solid #fde68a",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: windowStatus.active ? "#16a34a" : "#f59e0b",
                  display: "inline-block",
                }}
              />
              {windowStatus.active ? "PROMOTION ACTIVE NOW" : "SCHEDULED FOR EVENING"}
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "#7a5246", fontSize: "13px" }}>
            Automatically applies controlled end-of-day discounts to slow-moving inventory with surplus stock.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* Quick Override / Simulation Selector */}
          <div
            style={{
              display: "inline-flex",
              background: "#fffaf6",
              borderRadius: "8px",
              padding: "3px",
              border: "1px solid #f0c8bf",
            }}
          >
            <button
              onClick={() => handleToggleOverride("auto")}
              title="Activate automatically during configured evening hours (e.g. 6 PM)"
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: settingsForm.manualOverride === "auto" ? 700 : 500,
                background: settingsForm.manualOverride === "auto" ? "#d96c4a" : "transparent",
                color: settingsForm.manualOverride === "auto" ? "#fff" : "#5b2d1c",
              }}
            >
              ⏰ Auto ({settingsForm.startTime})
            </button>
            <button
              onClick={() => handleToggleOverride("force_on")}
              title="Force activate immediately for testing or off-hour promotions"
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: settingsForm.manualOverride === "force_on" ? 700 : 500,
                background: settingsForm.manualOverride === "force_on" ? "#166534" : "transparent",
                color: settingsForm.manualOverride === "force_on" ? "#fff" : "#5b2d1c",
              }}
            >
              ⚡ Force Active (Test)
            </button>
            <button
              onClick={() => handleToggleOverride("force_off")}
              title="Pause all promotions"
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: settingsForm.manualOverride === "force_off" ? 700 : 500,
                background: settingsForm.manualOverride === "force_off" ? "#dc2626" : "transparent",
                color: settingsForm.manualOverride === "force_off" ? "#fff" : "#5b2d1c",
              }}
            >
              🔒 Disabled
            </button>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="abtn"
            style={{
              background: showConfig ? "#5b2d1c" : "#fff",
              color: showConfig ? "#fff" : "#5b2d1c",
              border: "1.5px solid #5b2d1c",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          >
            ⚙️ {showConfig ? "Close Rules" : "Configure Rules"}
          </button>
        </div>
      </div>

      {/* Status Notice Banner */}
      <div
        style={{
          background: windowStatus.active ? "#f0fdf4" : "#fffbeb",
          border: windowStatus.active ? "1px solid #bbf7d0" : "1px solid #fef08a",
          borderRadius: "12px",
          padding: "12px 16px",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "20px" }}>{windowStatus.active ? "🎉" : "💡"}</span>
          <div>
            <strong style={{ color: windowStatus.active ? "#166534" : "#854d0e", fontSize: "13px" }}>
              {windowStatus.reason}
            </strong>
            <div style={{ fontSize: "12px", color: windowStatus.active ? "#15803d" : "#a16207", marginTop: "2px" }}>
              {windowStatus.active
                ? `${activeDeals.length} slow-moving products currently have active discounts applied on storefront and cart.`
                : `${data?.eligibleCount || 0} products are qualified. Discounts will activate automatically when the clock reaches ${settingsForm.startTime}.`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "#7a5246", fontWeight: 600 }}>
            Evening Window: <strong>{settingsForm.startTime} - {settingsForm.endTime}</strong>
          </span>
        </div>
      </div>

      {/* Config Form Modal / Accordion */}
      {showConfig && (
        <form
          onSubmit={handleSaveSettings}
          style={{
            background: "#fffaf6",
            border: "1.5px solid #f0c8bf",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            animation: "fadeUp 0.2s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3 style={{ margin: 0, color: "#5b2d1c", fontSize: "16px", fontWeight: 800 }}>
              ⚙️ Administrator Discount Rules
            </h3>
            <span style={{ fontSize: "12px", color: "#888" }}>
              Controlled discounts safeguard margins & prevent repeated reductions.
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              marginBottom: "18px",
            }}
          >
            {/* Start Time */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "4px" }}>
                Start Time (24h format):
              </label>
              <input
                type="time"
                value={settingsForm.startTime}
                onChange={(e) => setSettingsForm({ ...settingsForm, startTime: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #f0c8bf",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#888" }}>e.g. 18:00 = 6:00 PM</span>
            </div>

            {/* End Time */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "4px" }}>
                End Time (Closing):
              </label>
              <input
                type="time"
                value={settingsForm.endTime}
                onChange={(e) => setSettingsForm({ ...settingsForm, endTime: e.target.value })}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #f0c8bf",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#888" }}>e.g. 23:59</span>
            </div>

            {/* Minimum Stock Required */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "4px" }}>
                Minimum Stock Required:
              </label>
              <input
                type="number"
                min="1"
                max="500"
                value={settingsForm.minStock}
                onChange={(e) => setSettingsForm({ ...settingsForm, minStock: parseInt(e.target.value, 10) || 1 })}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #f0c8bf",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#888" }}>Only discount if remaining stock &gt;= this</span>
            </div>

            {/* Max Daily Sales */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "4px" }}>
                Max Daily Sales Threshold:
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settingsForm.maxDailySales}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxDailySales: parseInt(e.target.value, 10) || 0 })}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #f0c8bf",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#888" }}>Classify as slow-moving if today's sales &lt;= this</span>
            </div>

            {/* Minimum Discount % */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "4px" }}>
                Minimum Discount (%):
              </label>
              <input
                type="number"
                min="5"
                max="90"
                value={settingsForm.minDiscount}
                onChange={(e) => setSettingsForm({ ...settingsForm, minDiscount: parseInt(e.target.value, 10) || 5 })}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #f0c8bf",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#888" }}>e.g. 15% minimum off</span>
            </div>

            {/* Maximum Discount % */}
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "4px" }}>
                Maximum Discount (%):
              </label>
              <input
                type="number"
                min={settingsForm.minDiscount}
                max="90"
                value={settingsForm.maxDiscount}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxDiscount: parseInt(e.target.value, 10) || 35 })}
                required
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #f0c8bf",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "11px", color: "#888" }}>Caps maximum discount to safeguard margin</span>
            </div>
          </div>

          {/* Excluded Products Selector */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#5b2d1c", marginBottom: "6px" }}>
              Excluded Products (Will NEVER be discounted):
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                maxHeight: "150px",
                overflowY: "auto",
                background: "#fff",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #f0c8bf",
              }}
            >
              {allProducts.map((p) => {
                const isExcluded = settingsForm.excludedProductIds.includes(p.productId);
                return (
                  <button
                    type="button"
                    key={p.productId}
                    onClick={() => toggleProductExclusion(p.productId)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "16px",
                      border: isExcluded ? "1.5px solid #dc2626" : "1px solid #e5e7eb",
                      background: isExcluded ? "#fee2e2" : "#f9fafb",
                      color: isExcluded ? "#dc2626" : "#4b5563",
                      fontSize: "12px",
                      fontWeight: isExcluded ? 700 : 500,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>{isExcluded ? "✕" : "+"}</span>
                    <span>{p.productName}</span>
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: "11px", color: "#888", marginTop: "4px", display: "block" }}>
              Click a product badge to toggle its exclusion. Red badges are excluded from all Last Call discounts.
            </span>
          </div>

          {/* Save Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setShowConfig(false)}
              className="abtn"
              style={{ background: "#fff", border: "1px solid #f0c8bf", color: "#7a5246", padding: "8px 16px" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="abtn"
              style={{ background: "#d96c4a", color: "#fff", padding: "8px 20px", fontSize: "13px" }}
            >
              {saving ? "Saving..." : "Save Discount Rules"}
            </button>
          </div>
        </form>
      )}

      {/* Active Deals Cards Grid */}
      <div style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "14px",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 800, color: "#5b2d1c" }}>
            {windowStatus.active
              ? `🔥 Active Last Call Deals (${activeDeals.length} products on sale)`
              : `Eligible Products Preview (${allProducts.filter((p) => p.isEligible).length} slow-moving products)`}
          </div>

          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => setFilterEligible("all")}
              className="abtn"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "12px",
                background: filterEligible === "all" ? "#5b2d1c" : "#fff",
                color: filterEligible === "all" ? "#fff" : "#5b2d1c",
                border: "1px solid #f0c8bf",
              }}
            >
              All Products ({allProducts.length})
            </button>
            <button
              onClick={() => setFilterEligible("eligible")}
              className="abtn"
              style={{
                fontSize: "11px",
                padding: "4px 10px",
                borderRadius: "12px",
                background: filterEligible === "eligible" ? "#d96c4a" : "#fff",
                color: filterEligible === "eligible" ? "#fff" : "#d96c4a",
                border: "1px solid #f0c8bf",
              }}
            >
              Eligible ({allProducts.filter((p) => p.isEligible).length})
            </button>
          </div>
        </div>

        {activeDeals.length === 0 && windowStatus.active ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              background: "#fffaf6",
              borderRadius: "12px",
              border: "1px dashed #f0c8bf",
              color: "#7a5246",
            }}
          >
            No products currently match all eligibility criteria (sufficient stock + low daily sales).
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            {(windowStatus.active ? activeDeals : allProducts.filter((p) => p.isEligible)).map((deal) => (
              <div
                key={deal.productId}
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: deal.isDealActive ? "2px solid #d96c4a" : "1px solid #f0c8bf",
                  padding: "16px",
                  position: "relative",
                  boxShadow: deal.isDealActive
                    ? "0 6px 18px rgba(217, 108, 74, 0.12)"
                    : "0 2px 8px rgba(0,0,0,0.03)",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Discount Badge */}
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "#dc2626",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "11px",
                    padding: "3px 8px",
                    borderRadius: "10px",
                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.3)",
                  }}
                >
                  -{deal.discountPercentage}% OFF
                </div>

                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                  <img
                    src={getDonutImage({ image: deal.image, id: deal.productId })}
                    alt={deal.productName}
                    style={{ width: "48px", height: "48px", objectFit: "contain" }}
                  />
                  <div>
                    <h4 style={{ margin: 0, color: "#5b2d1c", fontSize: "14px", fontWeight: 800 }}>
                      {deal.productName}
                    </h4>
                    <span
                      style={{
                        fontSize: "11px",
                        color: deal.isDealActive ? "#166534" : "#7a5246",
                        fontWeight: 600,
                      }}
                    >
                      {deal.status}
                    </span>
                  </div>
                </div>

                {/* Price Display */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-end",
                    background: "#fffaf6",
                    borderRadius: "10px",
                    padding: "10px 12px",
                    border: "1px solid #f8d9d1",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#888", textDecoration: "line-through" }}>
                      Orig: ₱{deal.originalPrice.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: "#d96c4a" }}>
                      ₱{deal.discountedPrice.toFixed(2)}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "#166534", fontWeight: 700 }}>
                      Save ₱{deal.savings.toFixed(2)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#7a5246", marginTop: "2px" }}>
                      Stock: <strong>{deal.stockQuantity}</strong> ({deal.todaySales} sold today)
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Inventory Slow-Moving Diagnostics Table */}
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 700,
            color: "#5b2d1c",
            marginBottom: "10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Inventory Eligibility Breakdown ({displayProducts.length} items)</span>
          <span style={{ fontSize: "11px", color: "#888" }}>
            Re-evaluated live based on today's sales & stock
          </span>
        </div>

        <table style={{ width: "100%", minWidth: "650px", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#fff5f0", textAlign: "left", color: "#7a5246" }}>
              <th style={{ padding: "8px 12px", borderRadius: "6px 0 0 6px" }}>Product</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Stock</th>
              <th style={{ padding: "8px 12px", textAlign: "center" }}>Today's Sales</th>
              <th style={{ padding: "8px 12px" }}>Original Price</th>
              <th style={{ padding: "8px 12px" }}>Discount %</th>
              <th style={{ padding: "8px 12px" }}>Deal Price</th>
              <th style={{ padding: "8px 12px", borderRadius: "0 6px 6px 0" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {displayProducts.map((item) => (
              <tr key={item.productId} style={{ borderBottom: "1px solid #f9ede8" }}>
                <td style={{ padding: "8px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <img
                      src={getDonutImage({ image: item.image, id: item.productId })}
                      alt={item.productName}
                      style={{ width: "24px", height: "24px", objectFit: "contain" }}
                    />
                    <strong style={{ color: "#5b2d1c" }}>{item.productName}</strong>
                  </div>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700 }}>
                  <span style={{ color: item.stockQuantity <= 0 ? "#dc2626" : item.stockQuantity < settingsForm.minStock ? "#d97706" : "#166534" }}>
                    {item.stockQuantity}
                  </span>
                </td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  {item.todaySales}
                </td>
                <td style={{ padding: "8px 12px", color: "#7a5246" }}>
                  ₱{item.originalPrice.toFixed(2)}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {item.isEligible ? (
                    <span style={{ color: "#dc2626", fontWeight: 700 }}>-{item.discountPercentage}%</span>
                  ) : (
                    <span style={{ color: "#aaa" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  {item.isEligible ? (
                    <strong style={{ color: "#d96c4a" }}>₱{item.discountedPrice.toFixed(2)}</strong>
                  ) : (
                    <span style={{ color: "#7a5246" }}>₱{item.originalPrice.toFixed(2)}</span>
                  )}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      background: item.isDealActive
                        ? "#dcfce7"
                        : item.isEligible
                        ? "#ffedd5"
                        : "#f3f4f6",
                      color: item.isDealActive
                        ? "#166534"
                        : item.isEligible
                        ? "#c2410c"
                        : "#6b7280",
                    }}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
