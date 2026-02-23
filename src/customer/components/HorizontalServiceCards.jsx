import React, { useRef } from 'react';
import { FiStar, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const ServiceCard = ({ service, onPress, showDiscount = false }) => {
  const imgSrc =
    typeof service.image === 'object' && service.image.uri
      ? service.image.uri
      : typeof service.image === 'string'
      ? service.image
      : '/placeholder.png';

  return (
    <button
      onClick={() => onPress && onPress(service)}
      className="w-40 sm:w-44 md:w-48 lg:w-58 shrink-0 bg-slate-50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      {/* Image */}
      <div className="relative">
        <img
          src={imgSrc}
          alt={service.name}
          className="w-full aspect-square object-cover rounded-2xl"
          loading="lazy"
        />
        {showDiscount && service.discount && (
          <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-lg">
            {service.discount}% OFF
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-2 sm:p-2.5">
        <p className="text-xs sm:text-sm font-semibold text-slate-800 mb-1 line-clamp-2">
          {service.name}
        </p>

        <div className="flex items-center justify-between gap-1">
          {/* Price */}
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              ${service.price}
            </span>
            {service.originalPrice && (
              <span className="text-[10px] sm:text-xs text-slate-400 line-through">
                ${service.originalPrice}
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-0.5">
            <FiStar className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-xs sm:text-sm font-medium text-slate-800">
              {service.rating}
            </span>
            <span className="text-[10px] sm:text-xs text-slate-500 hidden sm:inline">
              ({service.reviews})
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

const HorizontalServiceCards = ({
  title = 'Most booked services',
  services = [],
  onServicePress,
  showTitle = true,
  showDiscount = false,
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
    <div className={`mb-6 sm:mb-8 lg:mt-20 lg:mb-15 ${className}`}>
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
        {services.map((service, index) => (
          <ServiceCard
            key={service.id || index}
            service={service}
            onPress={onServicePress}
            showDiscount={showDiscount}
          />
        ))}
      </div>
    </div>
  );
};

export default HorizontalServiceCards;
