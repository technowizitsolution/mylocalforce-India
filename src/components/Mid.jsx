import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const fallbackPromotions = [
  {
    id: 'massage-men',
    badge: 'Popular',
    title: 'Relax and rejuvenate at home',
    image: '/images/stressReliefMen.webp',
    bgColor: 'bg-green-700',
    buttonText: 'Book now',
    category: 'Glow Massage',
    searchQuery: 'Massage',
  },
  {
    id: 'massage-women',
    badge: 'Popular',
    title: 'Wellness therapy near you',
    image: '/images/stressReliefWomen.webp',
    bgColor: 'bg-yellow-600',
    buttonText: 'Book now',
    category: 'Glow Massage',
    searchQuery: 'Massage',
  },
  {
    id: 'beauty',
    badge: 'Trending',
    title: 'Beauty experts at home',
    image: '/images/Facial.webp',
    bgColor: 'bg-blue-600',
    buttonText: 'Explore',
    category: 'Glow Beauty',
    searchQuery: 'Beauty',
  },
  {
    id: 'cleaning',
    badge: 'Local services',
    title: 'Home cleaning made easy',
    image: '/images/cleaning.png',
    bgColor: 'bg-gray-100',
    buttonText: 'Explore',
    textColor: 'text-black',
    category: 'Cleaning Services',
    searchQuery: 'Cleaning',
  },
];

const getServiceImage = (service, fallback) =>
  service?.imageUrl || service?.image || service?.thumbnail || fallback || '/images/MLF.jpg';

const Mid = ({ services = [], loading = false }) => {
  const navigate = useNavigate();
  const carouselRef = useRef(null);
  const autoScrollRef = useRef(null);

  const AUTO_SCROLL_INTERVAL = 3000;

  const promotions = useMemo(() => {
    if (!Array.isArray(services) || services.length === 0) {
      return fallbackPromotions;
    }

    const colors = ['bg-green-700', 'bg-yellow-600', 'bg-blue-600', 'bg-gray-100'];

    return services.slice(0, 4).map((service, index) => ({
      id: service.id || `${service.name || 'service'}-${index}`,
      badge: index === 0 ? 'Popular' : 'Available now',
      title: service.name || service.title || 'Local service',
      image: getServiceImage(service, fallbackPromotions[index % fallbackPromotions.length].image),
      bgColor: colors[index % colors.length],
      buttonText: 'Book now',
      textColor: index % colors.length === 3 ? 'text-black' : undefined,
      category: service.category || 'All',
      searchQuery: service.name || service.title || '',
    }));
  }, [services]);

  const items = [...promotions, ...promotions, ...promotions];

  const openPromotion = (promo) => {
    navigate('/services', {
      state: {
        selectedCategory: promo.category || 'All',
        searchQuery: promo.searchQuery || '',
      },
    });
  };

  const getCardWidth = useCallback(() => {
    const el = carouselRef.current;
    if (!el || !el.children[0]) return 0;
    const card = el.children[0];
    const style = window.getComputedStyle(el);
    const gap = parseInt(style.columnGap, 10) || 0;
    return card.offsetWidth + gap;
  }, []);

  const scroll = useCallback(
    (direction) => {
      const el = carouselRef.current;
      if (!el) return;
      const cardWidth = getCardWidth();
      el.style.scrollBehavior = 'smooth';
      el.scrollBy({ left: direction === 'left' ? -cardWidth : cardWidth });
    },
    [getCardWidth]
  );

  const handleScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;

    const cardWidth = getCardWidth();
    const setWidth = promotions.length * cardWidth;

    if (el.scrollLeft <= setWidth * 0.5) {
      el.style.scrollBehavior = 'auto';
      el.scrollLeft += setWidth;
    }

    if (el.scrollLeft >= setWidth * 2) {
      el.style.scrollBehavior = 'auto';
      el.scrollLeft -= setWidth;
    }
  }, [getCardWidth, promotions.length]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    autoScrollRef.current = setInterval(() => {
      scroll('right');
    }, AUTO_SCROLL_INTERVAL);
  }, [scroll, stopAutoScroll]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return undefined;

    const initPosition = () => {
      const cardWidth = getCardWidth();
      el.style.scrollBehavior = 'auto';
      el.scrollLeft = promotions.length * cardWidth;
    };

    const timer = setTimeout(initPosition, 100);
    window.addEventListener('resize', initPosition);
    startAutoScroll();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', initPosition);
      stopAutoScroll();
    };
  }, [getCardWidth, promotions.length, startAutoScroll, stopAutoScroll]);

  return (
    <section className="px-4 sm:px-6 md:px-8 py-12 bg-white select-none">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
            Special Offers
          </h2>
          <div className="hidden sm:flex gap-2">
            <button
              onClick={() => scroll('left')}
              className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-6 overflow-hidden">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`offer-skeleton-${index}`}
                className="min-w-[90%] sm:min-w-[32rem] rounded-2xl bg-slate-100 shadow-sm shrink-0"
              >
                <div className="flex h-96 flex-col sm:h-52 sm:flex-row">
                  <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                    <div>
                      <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
                      <div className="mt-5 h-7 w-3/4 rounded bg-slate-200 animate-pulse" />
                    </div>
                    <div className="h-10 w-28 rounded-lg bg-slate-200 animate-pulse" />
                  </div>
                  <div className="h-44 bg-slate-200 animate-pulse sm:h-auto sm:w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="relative group" onMouseEnter={stopAutoScroll} onMouseLeave={startAutoScroll}>
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map((promo, index) => (
              <PromoCard
                key={`${promo.id}-${index}`}
                promo={promo}
                onOpen={() => openPromotion(promo)}
              />
            ))}
          </div>
        </div>
        )}
      </div>
    </section>
  );
};

const PromoCard = ({ promo, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`${promo.bgColor} min-w-[90%] sm:min-w-[32rem] snap-center rounded-2xl overflow-hidden shadow-sm shrink-0 transition-transform duration-300 text-left`}
  >
    <div className="flex flex-col sm:flex-row h-full sm:h-52">
      <div className={`flex flex-col justify-between p-6 sm:p-8 flex-1 ${promo.textColor || 'text-white'}`}>
        <div>
          {promo.badge && (
            <span className="inline-block mb-3 rounded-md bg-green-500/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {promo.badge}
            </span>
          )}
          <h3 className="text-xl md:text-2xl font-bold leading-tight mb-4">{promo.title}</h3>
        </div>
        <span
          className={`w-fit rounded-lg px-6 py-2.5 text-sm font-bold transition-all ${
            promo.textColor ? 'bg-black text-white' : 'bg-white text-gray-900'
          }`}
        >
          {promo.buttonText}
        </span>
      </div>

      <div className="h-44 sm:h-auto sm:w-1/2 relative">
        <img src={promo.image} alt={promo.title} className="h-full w-full object-cover" loading="lazy" />
      </div>
    </div>
  </button>
);

export default Mid;
