import React from "react";
import { FaTrash } from "react-icons/fa";
import Footer from "../components/Footer";
import "../styles/Cart.css";
import { useNavigate } from "react-router-dom"; 

function Cart({ cart, increaseQty, decreaseQty, removeItem }) {
  const navigate = useNavigate(); 

  const totalPrice = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <div className="cart-page">
      <main className="cart-container">
        <h1 className="cart-title">Your Cart</h1>

        {cart.length === 0 ? (
          <p className="cart-empty">Your cart is currently empty.</p>
        ) : (
          <>
            {cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <img src={item.image} alt={item.name} />
                <div className="cart-item-info">
                  <p className="cart-item-name">{item.name}</p>
                  <p className="cart-item-price">₱{item.price}</p>
                </div>

                <div className="cart-item-controls">
                  <button
                    className="qty-btn"
                    onClick={() => decreaseQty(item.id)}
                  >
                    -
                  </button>
                  <span className="cart-quantity">{item.quantity}</span>
                  <button
                    className="qty-btn"
                    onClick={() => increaseQty(item.id)}
                  >
                    +
                  </button>
                  <button
                    className="remove-btn"
                    onClick={() => removeItem(item.id)}
                    title="Remove item"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}

            <h2 className="cart-total">Total: ₱{totalPrice}</h2>

            <button
              className="checkout-btn"
              onClick={() => navigate("/checkout")}
            >
              Proceed to Checkout
            </button>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
export default Cart;
