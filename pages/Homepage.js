import React, { useState } from "react";
import HeroSection from "../components/HeroSection";
import DonutBanner from "../components/DonutBanner";
import SearchBar from "../components/SearchBar";
import Catalog from "../components/Catalog";
import Footer from "../components/Footer";

function Homepage({ products, addToCart }) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (query) => setSearchQuery(query);

  return (
    <div className="flex flex-col min-h-screen">
      <HeroSection />
      <DonutBanner />

      <div className="p-4 flex justify-center">
        <SearchBar onSearch={handleSearch} />
      </div>

     {searchQuery && (
        <p
          style={{ textAlign: "center", color: "#4b5563", marginBottom: "1rem" }}
        >
          You searched for: <strong>{searchQuery}</strong>
        </p>
      )}


      <Catalog products={products} searchQuery={searchQuery} addToCart={addToCart} />
      <Footer />
    </div>
  );
}

export default Homepage;
