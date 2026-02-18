import React, { useRef } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const SubCategoryCard = ({ subCategory, onPress }) => {
  const imgSrc =
    typeof subCategory.image === 'string'
      ? subCategory.image
      : subCategory.image?.uri || '/placeholder.png';

  return (
    <button
      onClick={() => onPress && onPress(subCategory)}
      className="w-36 sm:w-40 md:w-44 lg:w-58 shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <p className="text-xs sm:text-sm font-medium text-slate-800 py-2 px-3 sm:px-4 truncate">
        {subCategory.name}
      </p>
      <div className="w-full aspect-[4/3]">
        <img
          src={imgSrc}
          alt={subCategory.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </button>
  );
};

const HorizontalCategoryScroll = ({
  title,
  subCategories = [],
  onSubCategoryPress,
  showTitle = true,
  className = '',
}) => {
  const scrollRef = useRef(null);

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.offsetWidth * 0.6;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className={`mb-6 sm:mb-8 ${className}`}>
      {showTitle && (
        <div className="flex items-center justify-between mx-4 sm:mx-6 lg:mx-8 mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl lg:text-4xl font-bold text-slate-800">{title}</h2>
          <div className="hidden sm:flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Scroll left"
            >
              <FiChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Scroll right"
            >
              <FiChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pl-4 pr-4 sm:pl-6 sm:pr-6 lg:pl-8 lg:pr-8 scroll-smooth scrollbar-hide"
      >
        {subCategories.map((subCategory, index) => (
          <SubCategoryCard
            key={subCategory.id || index}
            subCategory={subCategory}
            onPress={onSubCategoryPress}
          />
        ))}
      </div>
    </div>
  );
};

export default HorizontalCategoryScroll;
