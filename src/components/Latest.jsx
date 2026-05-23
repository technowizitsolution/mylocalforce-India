import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const fallbackServices = [
  {
    id: 'men-salon',
    category: 'Men Grooming',
    title: 'Salon for Men at Home',
    description:
      'Professional haircut, beard styling, and grooming services delivered to your doorstep.',
    image: '/images/menSaloon.jpg',
    featured: true,
  },
  {
    id: 'hair-styling',
    category: 'Women Beauty',
    title: 'Hair Wash & Styling',
    description: 'Relaxing hair wash, conditioning, and professional styling for every occasion.',
    image: '/images/WomenHairWash.png',
  },
  {
    id: 'facial',
    category: 'Skin Care',
    title: 'Facial & Cleanup',
    description: 'Deep cleansing facial and glow treatment using premium skin-care products.',
    image: '/images/womenFacial.jpg',
  },
  {
    id: 'massage',
    category: 'Men Wellness',
    title: 'Stress Relief Massage',
    description: 'Massage therapy designed to relieve stress and reduce muscle tension.',
    image: '/images/stressReliefMen.webp',
  },
];

const normalizeService = (service, index = 0) => ({
  id: service.id || service.serviceId || `${service.name || service.title || 'service'}-${index}`,
  category: service.category || 'Service',
  title: service.title || service.name || service.serviceName || 'Local service',
  name: service.name || service.title || service.serviceName || 'Local service',
  description: service.description || 'Book this local service with My Local Force.',
  image: service.imageUrl || service.image || service.thumbnail || fallbackServices[index % fallbackServices.length].image,
  imageUrl: service.imageUrl || service.image || service.thumbnail || fallbackServices[index % fallbackServices.length].image,
  imageFit: service.imageFit || 'cover',
  imagePositionX: service.imagePositionX ?? 50,
  imagePositionY: service.imagePositionY ?? 50,
  price: service.price,
  duration: service.duration,
  whatsIncluded:
    service.whatsIncluded ||
    service.whatIncluded ||
    service.included ||
    service.includes ||
    service.features ||
    [],
  features: service.features || service.whatsIncluded,
  ownerId: service.ownerId,
  ownerName: service.ownerName,
  ownerEmail: service.ownerEmail,
  ownerPhone: service.ownerPhone,
  providers: service.providers || (service.ownerId ? [service.ownerId] : []),
  featured: service.featured,
});

const ServiceCard = ({ service, large, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    className={`group relative flex w-full appearance-none flex-col overflow-hidden rounded-2xl border-0 bg-white p-0 text-left align-top shadow-md transition-all duration-500 hover:shadow-2xl sm:rounded-3xl ${
      large ? 'self-start' : ''
    }`}
  >
    <div
      className={`relative shrink-0 overflow-hidden ${
        large ? 'h-48 sm:h-64 md:h-80 lg:h-[20rem]' : 'h-48 sm:h-40 md:h-48'
      }`}
    >
      <img
        src={service.image}
        alt={service.title}
        className="w-full h-full group-hover:scale-110 transition-transform duration-700"
        style={{
          objectFit: service.imageFit,
          objectPosition: `${service.imagePositionX}% ${service.imagePositionY}%`,
        }}
      />

      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />

      <span className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold bg-white/90 text-primary-700 rounded-full backdrop-blur">
        {service.category}
      </span>
    </div>

    <div className={`p-4 sm:p-5 md:p-6 ${large ? '' : 'flex flex-1 flex-col'}`}>
      <h3 className="text-base sm:text-lg md:text-xl font-extrabold mb-1 sm:mb-2 text-gray-900">
        {service.title}
      </h3>
      <p
        className={`mb-3 text-xs leading-5 text-gray-600 sm:mb-4 sm:text-sm sm:leading-6 ${
          large ? '' : 'line-clamp-3'
        }`}
      >
        {service.description}
      </p>

      <span
        className={`text-primary-700 font-semibold text-xs sm:text-sm group-hover:underline ${
          large ? '' : 'mt-auto'
        }`}
      >
        View service
        <ChevronRight className="ml-1 inline h-4 w-4" />
      </span>
    </div>
  </button>
);

const Latest = ({ services = [], loading = false }) => {
  const navigate = useNavigate();
  const visibleServices = useMemo(() => {
    const source = Array.isArray(services) && services.length > 0 ? services : fallbackServices;
    return source.slice(0, 4).map(normalizeService);
  }, [services]);

  const featured = visibleServices[0];
  const others = visibleServices.slice(1);

  const openService = (service) => {
    navigate('/service-detail', {
      state: {
        service,
      },
    });
  };

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12 md:px-8 md:py-14 bg-gray-50">
      <div className="mx-auto max-w-7xl">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-center mb-8 sm:mb-10 md:mb-14 text-gray-900">
          Browse our latest services
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="lg:col-span-1 lg:row-span-2 overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-md">
              <div className="h-48 sm:h-64 md:h-80 lg:h-[20rem] animate-pulse bg-slate-200" />
              <div className="p-4 sm:p-5 md:p-6">
                <div className="h-6 w-3/4 rounded bg-slate-200 animate-pulse" />
                <div className="mt-3 h-4 w-full rounded bg-slate-100 animate-pulse" />
                <div className="mt-2 h-4 w-2/3 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6 md:gap-8">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`latest-skeleton-${index}`} className="lg:flex lg:h-[13rem] lg:gap-6">
                  <div className="hidden h-full w-52 shrink-0 rounded-2xl bg-slate-200 animate-pulse lg:block xl:w-64" />
                  <div className="flex-1 rounded-2xl bg-white p-7 shadow-md">
                    <div className="h-5 w-24 rounded-full bg-slate-200 animate-pulse" />
                    <div className="mt-4 h-6 w-2/3 rounded bg-slate-200 animate-pulse" />
                    <div className="mt-3 h-4 w-full rounded bg-slate-100 animate-pulse" />
                    <div className="mt-2 h-4 w-3/4 rounded bg-slate-100 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <div className="lg:col-span-1 lg:self-start">
            <ServiceCard service={featured} large onOpen={() => openService(featured)} />
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6 md:gap-8">
            {others.map((service) => (
              <div key={service.id} className="lg:flex lg:h-[13rem] lg:gap-6">
                <button
                  type="button"
                  onClick={() => openService(service)}
                  className="hidden h-full w-52 shrink-0 appearance-none overflow-hidden rounded-2xl border-0 p-0 lg:block xl:w-64"
                >
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full hover:scale-105 transition-transform duration-500"
                    style={{
                      objectFit: service.imageFit,
                      objectPosition: `${service.imagePositionX}% ${service.imagePositionY}%`,
                    }}
                  />
                </button>

                <div className="lg:hidden">
                  <ServiceCard service={service} onOpen={() => openService(service)} />
                </div>

                <button
                  type="button"
                  onClick={() => openService(service)}
                  className="hidden h-full flex-1 appearance-none flex-col justify-center rounded-2xl border-0 bg-white p-7 text-left shadow-md transition-shadow hover:shadow-lg lg:flex"
                >
                  <span className="inline-block mb-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold w-fit">
                    {service.category}
                  </span>
                  <h3 className="text-lg xl:text-xl font-bold mb-2 text-black">{service.title}</h3>
                  <p className="mb-4 line-clamp-2 text-sm leading-6 text-gray-600">
                    {service.description}
                  </p>
                  <span className="text-primary-700 font-semibold text-sm hover:underline w-fit">
                    View service
                    <ChevronRight className="ml-1 inline h-4 w-4" />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
        )}
      </div>
    </section>
  );
};

export default Latest;
