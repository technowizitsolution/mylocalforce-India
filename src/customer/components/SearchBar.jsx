import React from 'react';
import { FiSearch } from 'react-icons/fi';

const SearchBar = ({
  searchText,
  onSearchChange,
  placeholder = 'Search for services...',
  onFilterPress,
  onSubmitEditing,
  className = '',
  containerClassName = '',
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSubmitEditing) {
      onSubmitEditing();
    }
  };

  return (
    <div
      className={`flex items-center bg-white mx-4 sm:mx-6 lg:mx-8 mb-4 px-3 sm:px-4 rounded-2xl border border-slate-100 shadow-lg ${containerClassName}`}
    >
      <FiSearch className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 mr-2 shrink-0" />
      <input
        type="text"
        className={`flex-1 py-3 sm:py-4 text-sm sm:text-base text-slate-800 placeholder-slate-400 bg-transparent outline-none ${className}`}
        placeholder={placeholder}
        value={searchText}
        onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={onFilterPress}
        className="p-2.5 sm:p-2 bg-indigo-100/20 rounded-lg ml-2 hover:bg-indigo-100/40 transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
        aria-label="Search"
      >
        <FiSearch className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-indigo-500" />
      </button>
    </div>
  );
};

export default SearchBar;