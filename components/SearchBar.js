import { useState } from "react";
import "../styles/SearchBar.css";

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState("");

  const handleInputChange = (e) => setQuery(e.target.value);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <form onSubmit={handleSubmit} className="search-bar-form">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Search for donuts..."
        className="search-bar-input"
      />
      <button type="submit" className="search-bar-button">
        Search
      </button>
    </form>
  );
};

export default SearchBar;
