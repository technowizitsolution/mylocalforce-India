import React from "react";

const services = [
    {
        id: 1,
        category: "Men Grooming",
        title: "Salon for Men at Home",
        description:
            "Professional haircut, beard styling, and grooming services delivered to your doorstep by experts.",
        image: "/images/menSaloon.jpg",
        featured: true,
    },
    {
        id: 2,
        category: "Women Beauty",
        title: "Hair Wash & Styling",
        description:
            "Relaxing hair wash, conditioning, and professional styling for every occasion.",
        image: "/images/WomenHairWash.png",
    },
    {
        id: 3,
        category: "Skin Care",
        title: "Facial & Cleanup",
        description:
            "Deep cleansing facial and glow treatment using premium skin-care products.",
        image: "/images/womenFacial.jpg",
    },
    {
        id: 4,
        category: "Men Wellness",
        title: "Stress Relief Head, Neck & Shoulder Massage",
        description:
            "Relaxing massage therapy designed to relieve stress, reduce muscle tension, and refresh your mind and body by trained professionals.",
        image: "/images/stressReliefMen.webp",
    },

];

const ServiceCard = ({ service, large }) => {
    return (
        <div
            className={`group relative bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 ${large ? "h-full" : ""
                }`}
        >
            {/* Image */}
                <div className={`relative overflow-hidden ${large
                    ? "h-48 sm:h-64 md:h-80 lg:h-112.5"
                    : "h-48 sm:h-40 md:h-48"
                }`}>
                <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />

                {/* Category Badge */}
                <span className="absolute top-3 left-3 sm:top-4 sm:left-4 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold bg-white/90 text-primary-700 rounded-full backdrop-blur">
                    {service.category}
                </span>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 md:p-6">
                <h3 className="text-base sm:text-lg md:text-xl font-extrabold mb-1 sm:mb-2 text-gray-900">
                    {service.title}
                </h3>
                <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">
                    {service.description}
                </p>

                <button className="text-primary-700 font-semibold text-xs sm:text-sm group-hover:underline">
                    Book Now →
                </button>
            </div>
        </div>
    );
};

const Latest = () => {
    const featured = services.find((s) => s.featured);
    const others = services.filter((s) => !s.featured);

    return (
        <section className="py-10 sm:py-12 md:py-16 lg:py-20 px-4 sm:px-6 md:px-8 bg-gray-50">
            <div className="mx-auto max-w-7xl">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-center mb-8 sm:mb-10 md:mb-14 text-gray-900">
                    Browse our latest services
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                    {/* Featured - Full width on mobile, 1 col on desktop */}
                    <div className="lg:col-span-1 lg:row-span-2">
                        <ServiceCard service={featured} large />
                    </div>

                    {/* Others - Stack on mobile, side by side on tablet, vertical on desktop */}
                    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 sm:gap-6 md:gap-8">
                        {others.map((service) => (
                            <div key={service.id} className="lg:flex lg:gap-6">
                                {/* On lg screens, show horizontal card */}
                                <div className="hidden lg:block w-52 xl:w-64 shrink-0 overflow-hidden rounded-2xl">
                                    <img
                                        src={service.image}
                                        alt={service.title}
                                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                                {/* Mobile/Tablet card */}
                                <div className="lg:hidden">
                                    <ServiceCard service={service} />
                                </div>
                                {/* Desktop content */}
                                <div className="hidden lg:flex flex-1 flex-col justify-center bg-white rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
                                    <span className="inline-block mb-2 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold w-fit">
                                        {service.category}
                                    </span>
                                    <h3 className="text-lg xl:text-xl font-bold mb-2 text-black">
                                        {service.title}
                                    </h3>
                                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                        {service.description}
                                    </p>
                                    <button className="text-primary-700 font-semibold text-sm hover:underline w-fit">
                                        Book Now →
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Latest;