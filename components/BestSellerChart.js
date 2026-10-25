import React, { useState, useEffect, useCallback } from "react";
import { getDonutImage } from "../data/donuts";

export default function BestSellerChart({ token }) {
  const [period, setPeriod] = useState("month"); // 'today' | 'week' | 'month' | 'all' | 'custom'
  const [metric, setMetric] = useState("units"); // 'units' | 'revenue'
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [hoveredProduct, setHoveredProduct] = useState(null);
  const [error, setError] = useState("");

  const fetchBestSellers = useCallback(async (activePeriod, start, end) => {
    setLoading(true);
    setError("");
    try {
      let url = `/api/analytics/best-sellers?period=${activePeriod}`;
      if (activePeriod === "custom") {
        if (start) url += `&startDate=${encodeURIComponent(start)}`;
        if (end) url += `&endDate=${encodeURIComponent(end)}`;
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load best seller analytics");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Best seller fetch error:", err);
      setError("Unable to load sales data. Please check connection.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBestSellers(period, customStart, customEnd);
  }, [period, fetchBestSellers]);

  const handleCustomApply = (e) => {
    e.preventDefault();
    if (!customStart && !customEnd) return;
    setPeriod("custom");
    fetchBestSellers("custom", customStart, customEnd);
  };

  const bestSellers = data?.bestSellers || [];
  const summary = data?.summary || { totalUnitsSold: 0, totalRevenue: 0, productCount: 0 };

  // Calculate highest metric for bar chart scaling
  const maxMetricValue = Math.max(
    1,
    ...bestSellers.map((item) => (metric === "units" ? item.unitsSold : item.salesRevenue))
  );

  const getRankBadge = (rank) => {
    if (rank === 1) return { label: "🥇 #1", bg: "#fef3c7", color: "#92400e", border: "#fde68a" };
    if (rank === 2) return { label: "🥈 #2", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
    if (rank === 3) return { label: "🥉 #3", bg: "#ffedd5", color: "#c2410c", border: "#fed7aa" };
    return { label: `#${rank}`, bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
  };

  return (
    <div
      className="bestseller-container"
      style={{
        background: "#ffffff",
        borderRadius: "16px",
        border: "1px solid #f0c8bf",
        padding: "24px",
        boxShadow: "0 4px 20px rgba(91, 45, 28, 0.04)",
        marginBottom: "28px",
      }}
    >
      {/* Header and Controls */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>🏆</span>
            <h2 style={{ margin: 0, color: "#5b2d1c", fontSize: "20px", fontWeight: 800 }}>
              Best Seller Products
            </h2>
            <span
              style={{
                fontSize: "11px",
                background: "#fdf2ed",
                color: "#d96c4a",
                border: "1px solid #f8d9d1",
                padding: "2px 8px",
                borderRadius: "12px",
                fontWeight: 700,
              }}
            >
              Real-time Sales
            </span>
          </div>
          <p style={{ margin: "6px 0 0", color: "#7a5246", fontSize: "13px" }}>
            Products ranked by sales volume, units sold, and current inventory levels.
          </p>
        </div>

        {/* View Toggle: Units vs Revenue */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", color: "#7a5246", fontWeight: 600 }}>Chart Metric:</span>
          <div
            style={{
              display: "inline-flex",
              background: "#fff5f0",
              borderRadius: "8px",
              padding: "3px",
              border: "1px solid #f0c8bf",
            }}
          >
            <button
              onClick={() => setMetric("units")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: metric === "units" ? 700 : 500,
                background: metric === "units" ? "#d96c4a" : "transparent",
                color: metric === "units" ? "#fff" : "#5b2d1c",
                transition: "all 0.15s ease",
              }}
            >
              📦 Units Sold
            </button>
            <button
              onClick={() => setMetric("revenue")}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: metric === "revenue" ? 700 : 500,
                background: metric === "revenue" ? "#d96c4a" : "transparent",
                color: metric === "revenue" ? "#fff" : "#5b2d1c",
                transition: "all 0.15s ease",
              }}
            >
              💰 Sales Revenue (₱)
            </button>
          </div>
        </div>
      </div>

      {/* Period Filter Buttons & Custom Range */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#5b2d1c", marginRight: "4px" }}>
            Period:
          </span>
          {[
            { id: "today", label: "Today" },
            { id: "week", label: "This Week" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Time" },
            { id: "custom", label: "Custom Range" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className="abtn"
              style={{
                padding: "7px 14px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: period === tab.id ? 700 : 600,
                background: period === tab.id ? "#d96c4a" : "#fff",
                color: period === tab.id ? "#fff" : "#5b2d1c",
                border: period === tab.id ? "1.5px solid #d96c4a" : "1.5px solid #f0c8bf",
                boxShadow: period === tab.id ? "0 2px 8px rgba(217, 108, 74, 0.25)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Form */}
        {period === "custom" && (
          <form
            onSubmit={handleCustomApply}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              background: "#fffaf6",
              padding: "6px 12px",
              borderRadius: "10px",
              border: "1px solid #f0c8bf",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "#7a5246", fontWeight: 600 }}>From:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid #f0c8bf",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <label style={{ fontSize: "12px", color: "#7a5246", fontWeight: 600 }}>To:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: "1px solid #f0c8bf",
                  fontSize: "12px",
                  outline: "none",
                }}
              />
            </div>
            <button
              type="submit"
              className="abtn"
              style={{
                background: "#d96c4a",
                color: "#fff",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            >
              Apply Filter
            </button>
          </form>
        )}
      </div>

      {/* KPI Highlights for Selected Period */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            background: "#fffaf6",
            border: "1px solid #f8d9d1",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#7a5246", fontWeight: 700, textTransform: "uppercase" }}>
            Total Units Sold ({period})
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#d96c4a", marginTop: "4px" }}>
            {summary.totalUnitsSold.toLocaleString()} units
          </div>
        </div>

        <div
          style={{
            background: "#fffaf6",
            border: "1px solid #f8d9d1",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#7a5246", fontWeight: 700, textTransform: "uppercase" }}>
            Sales Revenue ({period})
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#166534", marginTop: "4px" }}>
            ₱{summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div
          style={{
            background: "#fffaf6",
            border: "1px solid #f8d9d1",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <div style={{ fontSize: "11px", color: "#7a5246", fontWeight: 700, textTransform: "uppercase" }}>
            Top Performing Donut
          </div>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 800,
              color: "#5b2d1c",
              marginTop: "6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {summary.topSeller?.productName || "No sales yet"}
          </div>
          {summary.topSeller && (
            <div style={{ fontSize: "11px", color: "#7a5246", marginTop: "2px" }}>
              {summary.topSeller.unitsSold} units (₱{summary.topSeller.salesRevenue.toLocaleString()})
            </div>
          )}
        </div>
      </div>

      {/* Chart & Visual Bars */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#7a5246" }}>
          <div style={{ fontSize: "32px", animation: "spin 1s infinite linear" }}>🔄</div>
          <p style={{ marginTop: "10px", fontSize: "14px", fontWeight: 600 }}>Analyzing sales data...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: "20px",
            background: "#fee2e2",
            color: "#dc2626",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      ) : bestSellers.length === 0 || summary.totalUnitsSold === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "#fffaf6",
            borderRadius: "12px",
            border: "1.5px dashed #f0c8bf",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🍩</div>
          <h3 style={{ margin: "0 0 6px", color: "#5b2d1c" }}>No Sales Recorded for this Period</h3>
          <p style={{ color: "#7a5246", fontSize: "13px", maxWidth: "460px", margin: "0 auto 16px" }}>
            No customer purchases were logged for {period === "today" ? "today" : period === "week" ? "this week" : "this period"}.
            Switch to <strong>"This Month"</strong> or <strong>"All Time"</strong> to view historical best sellers.
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
            <button
              onClick={() => setPeriod("month")}
              className="abtn"
              style={{ background: "#d96c4a", color: "#fff", padding: "8px 16px" }}
            >
              📅 View This Month
            </button>
            <button
              onClick={() => setPeriod("all")}
              className="abtn"
              style={{ background: "#fff", border: "1px solid #d96c4a", color: "#d96c4a", padding: "8px 16px" }}
            >
              ✨ View All Time
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Visual Bar Graph */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#5b2d1c",
                marginBottom: "14px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Sales Volume Leaderboard ({metric === "units" ? "Units Sold" : "Revenue ₱"})</span>
              <span style={{ fontSize: "11px", color: "#888", fontWeight: 500 }}>
                Hover bar to inspect inventory & revenue
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {bestSellers.slice(0, 10).map((product) => {
                const badgeInfo = getRankBadge(product.rank);
                const value = metric === "units" ? product.unitsSold : product.salesRevenue;
                const percentage = maxMetricValue > 0 ? (value / maxMetricValue) * 100 : 0;
                const share = metric === "units" ? product.percentageOfUnits : product.percentageOfRevenue;
                const isHovered = hoveredProduct?.productId === product.productId;

                return (
                  <div
                    key={product.productId}
                    onMouseEnter={() => setHoveredProduct(product)}
                    onMouseLeave={() => setHoveredProduct(null)}
                    style={{
                      background: isHovered ? "#fff5f0" : "#fff",
                      border: isHovered ? "1.5px solid #d96c4a" : "1px solid #f7e5de",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      transition: "all 0.15s ease",
                      cursor: "default",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "6px",
                        gap: "10px",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                        <span
                          style={{
                            background: badgeInfo.bg,
                            color: badgeInfo.color,
                            border: `1px solid ${badgeInfo.border}`,
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {badgeInfo.label}
                        </span>
                        <img
                          src={getDonutImage({ image: product.image, id: product.productId })}
                          alt={product.productName}
                          style={{ width: "24px", height: "24px", objectFit: "contain", flexShrink: 0 }}
                        />
                        <strong
                          style={{
                            fontSize: "13px",
                            color: "#5b2d1c",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.productName}
                        </strong>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                        <span style={{ fontSize: "12px", color: "#7a5246" }}>
                          Stock:{" "}
                          <strong
                            style={{
                              color:
                                product.currentStock <= 0
                                  ? "#dc2626"
                                  : product.currentStock <= 5
                                  ? "#d97706"
                                  : "#166534",
                            }}
                          >
                            {product.currentStock}
                          </strong>
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 800,
                            color: metric === "units" ? "#d96c4a" : "#166534",
                          }}
                        >
                          {metric === "units"
                            ? `${product.unitsSold} units`
                            : `₱${product.salesRevenue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            background: "#f3f4f6",
                            color: "#6b7280",
                            padding: "2px 6px",
                            borderRadius: "6px",
                            fontWeight: 600,
                          }}
                        >
                          {share}% share
                        </span>
                      </div>
                    </div>

                    {/* Progress Fill Bar */}
                    <div
                      style={{
                        background: "#f5f5f5",
                        height: "10px",
                        borderRadius: "5px",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(percentage, 2)}%`,
                          background:
                            product.rank === 1
                              ? "linear-gradient(90deg, #d96c4a 0%, #f59e0b 100%)"
                              : product.rank === 2
                              ? "linear-gradient(90deg, #d96c4a 0%, #fb923c 100%)"
                              : "linear-gradient(90deg, #e07a5f 0%, #f4a261 100%)",
                          borderRadius: "5px",
                          transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Data Table */}
          <div style={{ overflowX: "auto" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#5b2d1c",
                marginBottom: "10px",
              }}
            >
              Detailed Sales Breakdown ({bestSellers.length} products)
            </div>

            <table
              style={{
                width: "100%",
                minWidth: "620px",
                borderCollapse: "collapse",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ background: "#fff5f0", textAlign: "left", color: "#7a5246" }}>
                  <th style={{ padding: "10px 14px", borderRadius: "8px 0 0 8px" }}>Rank</th>
                  <th style={{ padding: "10px 14px" }}>Product Name</th>
                  <th style={{ padding: "10px 14px" }}>Unit Price</th>
                  <th style={{ padding: "10px 14px", textAlign: "center" }}>Units Sold</th>
                  <th style={{ padding: "10px 14px", textAlign: "center" }}>Current Stock</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Sales Revenue</th>
                  <th style={{ padding: "10px 14px", borderRadius: "0 8px 8px 0", textAlign: "right" }}>
                    % of Sales
                  </th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map((item) => (
                  <tr
                    key={item.productId}
                    style={{
                      borderBottom: "1px solid #f9ede8",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "#d96c4a" }}>
                      #{item.rank}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img
                          src={getDonutImage({ image: item.image, id: item.productId })}
                          alt={item.productName}
                          style={{ width: "28px", height: "28px", objectFit: "contain" }}
                        />
                        <div>
                          <strong style={{ color: "#5b2d1c" }}>{item.productName}</strong>
                          <div style={{ fontSize: "11px", color: "#888" }}>{item.orderCount} orders</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#7a5246" }}>
                      ₱{item.currentPrice.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 800, color: "#d96c4a" }}>
                      {item.unitsSold}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 8px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background:
                            item.currentStock <= 0
                              ? "#fee2e2"
                              : item.currentStock <= 5
                              ? "#fef3c7"
                              : "#dcfce7",
                          color:
                            item.currentStock <= 0
                              ? "#dc2626"
                              : item.currentStock <= 5
                              ? "#92400e"
                              : "#166534",
                        }}
                      >
                        {item.currentStock} units
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontWeight: 800,
                        color: "#166534",
                      }}
                    >
                      ₱{item.salesRevenue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#7a5246", fontWeight: 600 }}>
                      {item.percentageOfUnits}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
