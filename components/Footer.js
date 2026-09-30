import React from "react";
import { FaFacebook, FaInstagram, FaTiktok } from "react-icons/fa";
import "../styles/Footer.css";
import logo from "../assets/glazyDayslogo.png";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">

        {/* Logo and Brand */}
        <div className="footer-section logo-section">
          <img src={logo} alt="Glazy Days Logo" className="footer-logo" />
          <span className="brand-name-footer">Glazy Days</span>
        </div>

        {/* About Section */}
        <div className="footer-section about">
          <h3>About Us</h3>
          <p>
            We provide the best donuts in town, fresh and delicious every day.
            Quality and taste guaranteed.
          </p>
        </div>

        {/* Contact Section */}
        <div className="footer-section contact">
          <h3>Contact Us</h3>
          <p>Email: glazydays@gdco.com</p>
          <p>Phone: 0999 784 7211</p>
          <p>Address: Cabuyao City, Laguna, Philippines</p>
        </div>

        {/* Social Media Section */}
        <div className="footer-section social">
          <h3>Follow Us</h3>
          <div className="social-icons">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><FaFacebook /></a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><FaInstagram /></a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer"><FaTiktok /></a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} All rights reserved. | <a href="/admin/login" style={{ color: 'inherit', textDecoration: 'none' }}>Admin Login</a>
      </div>
    </footer>
  );
};

export default Footer;
