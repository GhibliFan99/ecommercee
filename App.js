import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./pages/Homepage";
import Checkout from "./pages/Checkout";
import Cart from "./pages/Cart";
import Navigation from "./components/Navigation";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import Receipt from "./pages/Receipt";
import OrderTracking from "./pages/OrderTracking";
import QueueBoard from "./pages/QueueBoard";
import { CustomerProvider } from "./components/CustomerContext";
import CustomerAccountModal from "./components/CustomerAccountModal";
import { AdminRoute } from "./components/AdminRoute";
import "./styles/App.css";

function App() {
  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [toast, setToast] = useState("Added to cart!");

  useEffect(() => {
    fetch("/api/products")
      .then((response) => response.json())
      .then((data) => setProducts(data))
      .catch(() => setProducts([]));
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2000);
  };

  const addToCart = (donut) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === donut.id);
      if (existingItem) {
        if (existingItem.quantity >= donut.stock_quantity) {
          showToast(`Cannot add more. Only ${donut.stock_quantity} in stock!`);
          return prevCart;
        }
        showToast(`${donut.name} quantity increased!`);
        return prevCart.map((item) =>
          item.id === donut.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (donut.stock_quantity <= 0) {
        showToast(`Sorry, ${donut.name} is out of stock!`);
        return prevCart;
      }
      showToast(`${donut.name} added to cart!`);
      return [...prevCart, { ...donut, quantity: 1 }];
    });
  };

  const increaseQty = (id) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === id) {
          if (item.quantity >= item.stock_quantity) {
             return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const decreaseQty = (id) => {
    setCart((prevCart) =>
      prevCart
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(item.quantity - 1, 0) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  return (
    <CustomerProvider>
      <Router>
        <Navigation cartCount={cart.length} />
        <CustomerAccountModal />

        <Routes>
          <Route
            path="/"
            element={<Homepage products={products} addToCart={addToCart} />}
          />
          <Route
            path="/checkout"
            element={<Checkout cart={cart} clearCart={() => setCart([])} />}
          />

          <Route
            path="/cart"
            element={
              <Cart
                cart={cart}
                increaseQty={increaseQty}
                decreaseQty={decreaseQty}
                removeItem={removeItem}
              />
            }
          />

          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route path="/receipt/:orderNumber" element={<Receipt />} />
          <Route path="/track" element={<OrderTracking />} />
          <Route path="/track/:orderNumber" element={<OrderTracking />} />
          <Route path="/queue" element={<QueueBoard />} />
        </Routes>
      </Router>
    </CustomerProvider>
  );
}

export default App;
