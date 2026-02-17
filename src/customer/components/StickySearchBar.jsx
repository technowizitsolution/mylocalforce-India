import React from 'react';
import SearchBar from './SearchBar';

const StickySearchBar = ({
  isVisible,
  searchText,
  onSearchChange,
  onFilterPress,
  onSubmitEditing,
  placeholder = 'Search for services...',
}) => {
  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm shadow-lg transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="w-full max-w-7xl mx-auto pt-3 sm:pt-4 pb-1">
        <SearchBar
          searchText={searchText}
          onSearchChange={onSearchChange}
          onFilterPress={onFilterPress}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          containerClassName="bg-gray-50 shadow-lg"
        />
      </div>
    </div>
  );
};

export default StickySearchBar;