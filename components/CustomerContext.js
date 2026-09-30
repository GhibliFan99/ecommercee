import React, { createContext, useContext, useState, useEffect } from "react";

const CustomerContext = createContext(null);

export function CustomerProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("register"); // 'register' | 'login' | 'profile' | 'orders'

  useEffect(() => {
    const savedToken = localStorage.getItem("glazy_customer_token");
    const savedCustomer = localStorage.getItem("glazy_customer");

    if (savedToken && savedCustomer) {
      try {
        setToken(savedToken);
        setCustomer(JSON.parse(savedCustomer));
      } catch (e) {
        localStorage.removeItem("glazy_customer_token");
        localStorage.removeItem("glazy_customer");
      }
    }
  }, []);

  const loginCustomer = (newToken, customerData) => {
    setToken(newToken);
    setCustomer(customerData);
    localStorage.setItem("glazy_customer_token", newToken);
    localStorage.setItem("glazy_customer", JSON.stringify(customerData));
  };

  const logoutCustomer = () => {
    setToken(null);
    setCustomer(null);
    localStorage.removeItem("glazy_customer_token");
    localStorage.removeItem("glazy_customer");
  };

  const updateCustomerData = (updatedData) => {
    const merged = { ...customer, ...updatedData };
    setCustomer(merged);
    localStorage.setItem("glazy_customer", JSON.stringify(merged));
  };

  const openAccountModal = (tab = "register") => {
    if (customer && (tab === "register" || tab === "login")) {
      setModalTab("profile");
    } else {
      setModalTab(tab);
    }
    setIsModalOpen(true);
  };

  const closeAccountModal = () => {
    setIsModalOpen(false);
  };

  return (
    <CustomerContext.Provider
      value={{
        customer,
        token,
        isLoggedIn: Boolean(customer && token),
        loginCustomer,
        logoutCustomer,
        updateCustomerData,
        isModalOpen,
        modalTab,
        setModalTab,
        openAccountModal,
        closeAccountModal,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error("useCustomer must be used within a CustomerProvider");
  }
  return context;
}
