import React, { useRef } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const BannerCarousel = ({
  banners = [],
  onBannerPress,
  className = '',
}) => {
  const scrollRef = useRef(null);

  const handleBannerPress = (banner, index) => {
    if (onBannerPress) {
      onBannerPress(banner, index);
    }
  };

  const scroll = (direction) => {
    if (!scrollRef.current) return;
    const scrollAmount = scrollRef.current.offsetWidth * 0.85;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div className={`mb-6 sm:mb-8 relative group ${className}`}>
      {/* Left Arrow — hidden on touch devices, visible on hover for pointer devices */}
      {/* {banners.length > 1 && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white shadow-md rounded-full p-2 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Previous banner"
        >
          <FiChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
      )} */}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 scroll-smooth snap-x snap-mandatory scrollbar-hide"
      >
        {banners.map((banner, index) => {
          const src = banner.source || banner.uri || banner;
          return (
            <button
              key={index}
              onClick={() => handleBannerPress(banner, index)}
              className="shrink-0 basis-[85%] sm:basis-[70%] md:basis-[60%] lg:basis-1/2 h-[140px] sm:h-[160px] md:h-[180px] lg:h-[230px] xl:h-[250px] rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow snap-center"
            >
              <img
                src={typeof src === 'string' ? src : src.uri}
                alt={banner.alt || `Banner ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          );
        })}
      </div>

      {/* Right Arrow */}
      {/* {banners.length > 1 && (
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white shadow-md rounded-full p-2 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Next banner"
        >
          <FiChevronRight className="w-5 h-5 text-gray-700" />
        </button>
      )} */}
    </div>
  );
};

export default BannerCarousel;