import React, { useEffect, useRef, useState } from 'react';
import { FiLoader, FiMapPin } from 'react-icons/fi';
import {
  fetchAutocompleteSuggestions,
  geocodeAddress,
} from '../utils/googleMaps';

const AddressAutocompleteField = ({
  value,
  onValueChange,
  onAddressSelect,
  placeholder = 'Start typing your address...',
  required = false,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const selectingRef = useRef(false);

  useEffect(() => {
    if (selectingRef.current) {
      return undefined;
    }

    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return undefined;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);

      try {
        const results = await fetchAutocompleteSuggestions(value.trim());
        setSuggestions(results);
      } catch (error) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [value]);

  const handleSelectSuggestion = async (suggestion) => {
    selectingRef.current = true;
    onValueChange?.(suggestion.description);
    setSuggestions([]);

    try {
      const geocoded = await geocodeAddress(suggestion.description);

      if (geocoded) {
        onAddressSelect?.({
          formattedAddress: geocoded.formattedAddress,
          latitude: geocoded.lat,
          longitude: geocoded.lng,
          place_id: suggestion.place_id,
        });
      } else {
        onAddressSelect?.({
          formattedAddress: suggestion.description,
          latitude: null,
          longitude: null,
          place_id: suggestion.place_id,
        });
      }
    } finally {
      window.setTimeout(() => {
        selectingRef.current = false;
      }, 100);
    }
  };

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        Address{required ? ' *' : ''}
      </label>
      <div className="relative">
        <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={value}
          onChange={(event) => onValueChange?.(event.target.value)}
          placeholder={placeholder}
          className="w-full h-14 px-4 pl-11 pr-10 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
        />
        {loading && (
          <FiLoader className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 animate-spin" />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              {suggestion.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default AddressAutocompleteField;
