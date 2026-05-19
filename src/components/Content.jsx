import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const fallbackCards = [
  {
    id: 'beauty',
    title: 'Beauty Services',
    description: 'Professional beauty and grooming services at home.',
    image: '/images/WomenHairWash.png',
    category: 'Glow Beauty',
  },
  {
    id: 'cleaning',
    title: 'Cleaning Services',
    description: 'Home, oven, BBQ, solar panel, and end-of-lease cleaning.',
    image: '/images/cleaning.png',
    category: 'Cleaning Services',
  },
  {
    id: 'massage',
    title: 'Massage Services',
    description: 'Relaxation and wellness therapy from local professionals.',
    image: '/images/stressReliefMen.webp',
    category: 'Glow Massage',
  },
  {
    id: 'nails',
    title: 'Nail Care',
    description: 'Manicure, pedicure, and nail care services.',
    image: '/images/Facial.webp',
    category: 'Glow Nails',
  },
];

const getCategoryName = (category) =>
  typeof category === 'string' ? category : category?.name || category?.title || 'Services';

const getServiceImage = (service, fallback) =>
  service?.imageUrl || service?.image || service?.thumbnail || fallback || '/images/MLF.jpg';

const Content = ({ categories = [], services = [], loading = false }) => {
  const navigate = useNavigate();

  const cards = useMemo(() => {
    if (!Array.isArray(categories) || categories.length === 0) {
      return fallbackCards;
    }

    return categories.slice(0, 4).map((category, index) => {
      const name = getCategoryName(category);
      const matchingService = services.find((service) => service.category === name);
      const count = services.filter((service) => service.category === name).length;
      const fallback = fallbackCards[index % fallbackCards.length];

      return {
        id: category.id || name,
        title: name,
        description:
          category.description ||
          (count > 0 ? `${count} services available` : `Explore ${name.toLowerCase()} options`),
        image: getServiceImage(matchingService, category.imageUrl || category.image || fallback.image),
        category: name,
      };
    });
  }, [categories, services]);

  const openCategory = (category) => {
    navigate('/services', {
      state: {
        selectedCategory: category || 'All',
      },
    });
  };

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-8 sm:py-12 md:py-16 lg:py-20 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 sm:mb-14 md:mb-20 text-center">
          <p className="text-[#2969E7] font-bold text-xs sm:text-sm mb-2 sm:mb-4 tracking-widest uppercase">
            OUR SERVICES
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-3 sm:mb-4 leading-tight">
            Find Local Services
          </h2>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
            Browse live service categories and book trusted local professionals near you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          {loading ? Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`category-skeleton-${index}`}
              className="h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg bg-white"
            >
              <div className="h-48 sm:h-56 md:h-64 animate-pulse bg-slate-200" />
              <div className="p-4 sm:p-5 md:p-6">
                <div className="h-5 w-2/3 rounded bg-slate-200 animate-pulse" />
                <div className="mt-3 h-4 w-full rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
                <div className="mt-4 h-1 w-12 rounded-full bg-slate-200 animate-pulse" />
              </div>
            </div>
          )) : cards.map((service) => (
            <button
              type="button"
              key={service.id}
              onClick={() => openCategory(service.category)}
              className="group cursor-pointer text-left transform transition duration-500 hover:-translate-y-2"
            >
              <div className="h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 bg-white">
                <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden bg-gray-200">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-[#2969E7]/80 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end justify-end p-4">
                    <ChevronRight className="h-7 w-7 text-white" />
                  </div>
                </div>

                <div className="p-4 sm:p-5 md:p-6">
                  <h3 className="text-black text-base sm:text-lg font-bold leading-tight group-hover:text-[#2969E7] transition">
                    {service.title}
                  </h3>

                  <p className="mt-2 text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4">
                    {service.description}
                  </p>

                  <div className="w-10 sm:w-12 h-1 bg-[#2969E7] rounded-full group-hover:w-full transition-all duration-300" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Content;
