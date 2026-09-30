import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function Receipt() {
  const { orderNumber } = useParams();
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`http://localhost:3001/api/receipts/${orderNumber}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || data.message) {
          throw new Error(data.message || "Receipt not found.");
        }
        setReceipt(data);
      })
      .catch((err) => {
        // Fallback to localStorage for Vercel / offline mode
        try {
          const cached = localStorage.getItem(`glazy_receipt_${orderNumber}`);
          if (cached) {
            setReceipt(JSON.parse(cached));
            return;
          }
          const savedOrders = JSON.parse(localStorage.getItem("glazy_orders") || "[]");
          const found = savedOrders.find((o) => o.order_number === orderNumber || o.orderNumber === orderNumber);
          if (found) {
            setReceipt({
              orderNumber: found.order_number || found.orderNumber,
              orderDate: found.created_at || new Date().toISOString(),
              storeName: "Glazy Days - Donut Shop",
              pickupDate: found.pickup_date || "Today",
              pickupTime: found.pickup_time || "12:00 PM",
              paymentMethod: found.payment_method || "GCash",
              paymentStatus: found.payment_status || "Pending Verification",
              orderStatus: found.status || "Pending Payment",
              paymentReference: found.payment_reference || "N/A",
              pickupInstructions: "Please present this receipt upon pickup at our counter.",
              items: found.items || [],
              totalAmount: found.total_amount || 0,
            });
            return;
          }
        } catch (e) {
          console.error(e);
        }
        setError(err.message || "Unable to load receipt.");
      });
  }, [orderNumber]);

  if (error) {
    return <div style={{ padding: "40px", textAlign: "center" }}>{error}</div>;
  }

  if (!receipt) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading receipt...</div>;
  }

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const text = `
-----------------------------------------
          ${receipt.storeName}
             DIGITAL RECEIPT
-----------------------------------------

Order Number: ${receipt.orderNumber}
Date: ${new Date(receipt.orderDate).toLocaleDateString()}
Time: ${new Date(receipt.orderDate).toLocaleTimeString()}

ITEMS
-----------------------------------------
${receipt.items.map(i => `${i.name.padEnd(20)} x${i.quantity.toString().padEnd(4)} ₱${i.unitPrice.toFixed(2)}`).join('\n')}
-----------------------------------------
Subtotal:                    ₱${receipt.totalAmount.toFixed(2)}
Total:                       ₱${receipt.totalAmount.toFixed(2)}

Payment Method: ${receipt.paymentMethod}
Payment Status: ${receipt.paymentStatus}

PICKUP DETAILS
Date: ${receipt.pickupDate || 'N/A'}
Time: ${receipt.pickupTime || 'N/A'}

${receipt.pickupInstructions}

Thank you for your order!
-----------------------------------------
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt-${receipt.orderNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="receipt-outer" style={{ padding: "40px 20px", background: "#fffaf6", minHeight: "100vh" }}>
      <div className="receipt-card" style={{ maxWidth: "720px", margin: "0 auto", background: "#fff", borderRadius: "18px", boxShadow: "0 12px 30px rgba(80, 40, 20, 0.08)", padding: "28px" }}>
        <h2 style={{ textAlign: "center", color: "#5b2d1c", marginBottom: "20px" }}>{receipt.storeName}</h2>
        <p style={{ textAlign: "center", color: "#6b4a3d", marginBottom: "24px" }}>Order Number: {receipt.orderNumber}</p>

        <div style={{ marginBottom: "24px" }}>
          <p><strong>Date:</strong> {new Date(receipt.orderDate).toLocaleDateString()}</p>
          <p><strong>Time:</strong> {new Date(receipt.orderDate).toLocaleTimeString()}</p>
          <p><strong>Pickup Date:</strong> {receipt.pickupDate || "N/A"}</p>
          <p><strong>Pickup Time:</strong> {receipt.pickupTime || "N/A"}</p>
          <p><strong>Payment Method:</strong> {receipt.paymentMethod}</p>
          {receipt.paymentReference && (
            <p><strong>Reference #:</strong> <span style={{ fontFamily: "monospace", background: "#f0f0f0", padding: "2px 6px", borderRadius: "4px" }}>{receipt.paymentReference}</span></p>
          )}
          <p style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <strong>Payment Status:</strong>
            <span style={{
              padding: "3px 10px",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "12px",
              background: receipt.paymentStatus === "Verified" ? "#dcfce7" : receipt.paymentStatus === "Rejected" ? "#fee2e2" : "#fef3c7",
              color: receipt.paymentStatus === "Verified" ? "#166534" : receipt.paymentStatus === "Rejected" ? "#dc2626" : "#92400e",
            }}>
              {receipt.paymentStatus}
            </span>
          </p>
          <p style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <strong>Order Status:</strong>
            <span style={{
              padding: "3px 10px",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "12px",
              background: (receipt.orderStatus === "Confirmed" || receipt.orderStatus === "Processing") ? "#dcfce7" : (receipt.orderStatus === "Pending Payment" || receipt.orderStatus === "Awaiting Payment Verification") ? "#fef3c7" : receipt.orderStatus === "Cancelled" ? "#fee2e2" : "#f3f4f6",
              color: (receipt.orderStatus === "Confirmed" || receipt.orderStatus === "Processing") ? "#166534" : (receipt.orderStatus === "Pending Payment" || receipt.orderStatus === "Awaiting Payment Verification") ? "#92400e" : receipt.orderStatus === "Cancelled" ? "#dc2626" : "#374151",
            }}>
              {receipt.orderStatus}
            </span>
          </p>
          {(receipt.paymentStatus === "Pending Verification" || receipt.orderStatus === "Pending Payment" || receipt.orderStatus === "Awaiting Payment Verification") && (
            <div style={{
              background: "#fffbea",
              border: "1px solid #f6c90e",
              borderRadius: "8px",
              padding: "10px 14px",
              marginTop: "10px",
              fontSize: "13px",
              color: "#92710a",
            }}>
              ⏳ Your payment is pending verification by our team. Your order will be confirmed once the payment is verified.
            </div>
          )}
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginBottom: "20px" }}>
          <table style={{ width: "100%", minWidth: "320px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#fff1eb" }}>
                <th style={{ padding: "10px 12px", textAlign: "left" }}>Item</th>
                <th style={{ padding: "10px 12px", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Unit</th>
                <th style={{ padding: "10px 12px", textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(receipt.items || []).map((item, index) => (
                <tr key={`${item.name}-${index}`}>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1ddcf" }}>{item.name}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1ddcf", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1ddcf", textAlign: "right" }}>₱{Number(item.unitPrice).toFixed(2)}</td>
                  <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1ddcf", textAlign: "right" }}>₱{Number(item.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ textAlign: "right", marginTop: "10px" }}>
          <h3 style={{ color: "#5b2d1c" }}>Total: ₱{Number(receipt.totalAmount).toFixed(2)}</h3>
        </div>

        <p style={{ marginTop: "24px", color: "#6b4a3d", textAlign: "center", fontSize: "14px" }}>{receipt.pickupInstructions}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '28px', flexWrap: 'wrap' }} className="no-print">
          <button onClick={handlePrint} style={{ flex: '1 1 140px', maxWidth: '220px', padding: '12px 18px', background: '#fff', color: '#d96c4a', border: '2px solid #d96c4a', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            Print Receipt
          </button>
          <button onClick={handleDownload} style={{ flex: '1 1 140px', maxWidth: '220px', padding: '12px 18px', background: '#d96c4a', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
            Download Receipt
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 600px) {
          .receipt-outer { padding: 16px 12px !important; }
          .receipt-card { padding: 18px 14px !important; border-radius: 14px !important; }
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}} />
    </div>
  );
}

export default Receipt;
