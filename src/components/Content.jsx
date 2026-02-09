import React from 'react'

const Content = () => {
  const services = [
    {
      id: '01',
      title: 'Hair Wash & Blow Dry',
      description: 'Professional hair washing and styling',
      image: '/WomenHairWash.png'
    },
    {
      id: '02',
      title: 'Waxing & Hair Removal',
      description: 'Smooth and long-lasting results',
      image: '/Waxing.webp'
    },
    {
      id: '03',
      title: 'Nail Care',
      description: 'Manicure and pedicure services',
      image: '/Facial.webp'
    },
    {
      id: '04',
      title: 'Stress Relief Massage',
      description: 'Relaxation and wellness therapy',
      image: '/stressReliefMen.webp'
    }
  ]

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-8 sm:py-12 md:py-16 lg:py-20 px-4 sm:px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="mb-10 sm:mb-14 md:mb-20 text-center">
          <p className="text-[#2969E7] font-bold text-xs sm:text-sm mb-2 sm:mb-4 tracking-widest uppercase">
            — OUR SERVICES
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-black mb-3 sm:mb-4 leading-tight">
            Premium Beauty & Wellness
          </h2>
          <p className="text-gray-600 text-sm sm:text-base md:text-lg max-w-2xl mx-auto px-4">
            Experience our expertly curated services designed to enhance your beauty and wellness with professional care and attention to detail.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
          {services.map((service) => (
            <div 
              key={service.id} 
              className="group cursor-pointer transform transition duration-500 hover:-translate-y-2"
            >
              {/* Card Container */}
              <div className="h-full rounded-xl sm:rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition duration-300 bg-white">
                
                {/* Image Container */}
                <div className="relative h-48 sm:h-56 md:h-64 overflow-hidden bg-gray-200">
                  <img 
                    src={service.image} 
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition duration-500"
                  />
                  
                  {/* Blue Overlay on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2969E7]/80 to-transparent opacity-0 group-hover:opacity-100 transition duration-300 flex items-end justify-end p-4">
                    <span className="text-white text-xl sm:text-2xl font-bold">→</span>
                  </div>
                </div>

                {/* Content Sectin */}
                <div className="p-4 sm:p-5 md:p-6">
                  <div className="flex items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div className="flex-1">
                      <h3 className="text-black text-base sm:text-lg font-bold leading-tight group-hover:text-[#2969E7] transition">
                        {service.title}
                      </h3>
                    </div>
                  </div>
                  
                  <p className="text-gray-500 text-xs sm:text-sm mb-3 sm:mb-4">
                    {service.description}
                  </p>

                  {/* Bottom Border Accent */}
                  <div className="w-10 sm:w-12 h-1 bg-[#2969E7] rounded-full group-hover:w-full transition-all duration-300"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Content