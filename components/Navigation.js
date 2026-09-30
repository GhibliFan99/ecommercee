import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  FaShoppingCart,
  FaUserLock,
  FaUserPlus,
  FaUserCheck,
  FaChevronDown,
  FaBoxOpen,
  FaSignOutAlt,
  FaBars,
  FaTimes,
  FaHome,
  FaSignInAlt,
  FaIdCard
} from "react-icons/fa";
import glazyDaysLogo from "../assets/glazyDayslogo.png";
import { useCustomer } from "./CustomerContext";
import "../styles/Nav.css";

function Navigation({ cartCount }) {
  const { customer, isLoggedIn, openAccountModal, logoutCustomer } = useCustomer();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Close mobile menu whenever route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowDropdown(false);
  }, [location.pathname]);

  const firstName = customer?.full_name ? customer.full_name.split(" ")[0] : "Customer";

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const closeAllMenus = () => {
    setMobileMenuOpen(false);
    setShowDropdown(false);
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        {/* Brand Logo & Name */}
        <div className="nav-left">
          <NavLink to="/" className="brand-link" onClick={closeAllMenus}>
            <img src={glazyDaysLogo} alt="Glazy Days Logo" className="logo-img" />
            <h2 className="logo-text">Glazy Days</h2>
          </NavLink>
        </div>

        {/* Mobile Header Actions (Cart + Hamburger Button) */}
        <div className="mobile-header-actions">
          <NavLink to="/cart" className="mobile-cart-btn" onClick={closeAllMenus} title="View Cart">
            <FaShoppingCart size={20} />
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </NavLink>

          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <FaTimes size={22} /> : <FaBars size={22} />}
          </button>
        </div>

        {/* Navigation Links Menu (Desktop row, Mobile collapsible drawer) */}
        <div className={`nav-menu-wrapper ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <ul className="nav-links">
            <li>
              <NavLink to="/" end onClick={closeAllMenus} className={({ isActive }) => (isActive ? "active" : "")}>
                <FaHome className="nav-icon-mobile" />
                <span>Home</span>
              </NavLink>
            </li>

            {/* Customer Account Button / Register Section */}
            {!isLoggedIn ? (
              <>
                <li className="nav-btn-item">
                  <button
                    type="button"
                    className="nav-register-btn"
                    onClick={() => {
                      closeAllMenus();
                      openAccountModal("register");
                    }}
                    title="Register your account for delivery details and tracking"
                  >
                    <FaUserPlus size={14} />
                    <span>Register Account</span>
                  </button>
                </li>
                <li className="nav-btn-item">
                  <button
                    type="button"
                    className="nav-signin-btn"
                    onClick={() => {
                      closeAllMenus();
                      openAccountModal("login");
                    }}
                  >
                    <FaSignInAlt size={13} className="nav-icon-mobile" />
                    <span>Sign In</span>
                  </button>
                </li>
              </>
            ) : (
              <li className="nav-user-dropdown-container">
                <button
                  type="button"
                  className="nav-user-badge-btn"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <FaUserCheck size={14} color="#CD2C58" />
                  <span>Hi, {firstName}!</span>
                  <FaChevronDown size={10} style={{ marginLeft: "2px" }} />
                </button>

                {showDropdown && (
                  <div className="nav-user-dropdown-menu">
                    <div className="dropdown-user-header">
                      <div className="dropdown-user-name">{customer?.full_name}</div>
                      <div className="dropdown-user-email">{customer?.email}</div>
                    </div>

                    <button
                      type="button"
                      className="dropdown-menu-item"
                      onClick={() => {
                        closeAllMenus();
                        openAccountModal("profile");
                      }}
                    >
                      <FaIdCard size={14} color="#CD2C58" />
                      <span>My Delivery Details</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-menu-item"
                      onClick={() => {
                        closeAllMenus();
                        openAccountModal("orders");
                      }}
                    >
                      <FaBoxOpen size={14} color="#CD2C58" />
                      <span>My Orders</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-menu-item dropdown-logout-btn"
                      onClick={() => {
                        closeAllMenus();
                        logoutCustomer();
                      }}
                    >
                      <FaSignOutAlt size={13} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </li>
            )}

            {/* Desktop Cart Link (Hidden on mobile header bar, accessible in list) */}
            <li className="cart-link desktop-cart-only">
              <NavLink to="/cart" className="cart-icon" onClick={closeAllMenus} title="View Cart">
                <FaShoppingCart size={22} />
                {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
              </NavLink>
            </li>

            <li className="admin-link-item">
              <NavLink
                to="/admin/login"
                className="admin-nav-link"
                onClick={closeAllMenus}
                title="Admin Login"
              >
                <FaUserLock size={18} />
                <span className="admin-label-mobile">Admin Portal</span>
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navigation;
