import React, { useRef, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react' // Suggested icons

const Mid = () => {
  const carouselRef = useRef(null)
  const autoScrollRef = useRef(null)

  const AUTO_SCROLL_INTERVAL = 3000 // Increased slightly for better readability

  const promotions = [
    { id: 1, badge: 'Up to $21 off', title: 'Relax & rejuvenate at home', image: '/images/stressReliefMen.webp', bgColor: 'bg-green-700', buttonText: 'Book now' },
    { id: 2, badge: 'Up to $21 off', title: 'Relax & rejuvenate at home', image: '/images/stressReliefWomen.webp', bgColor: 'bg-yellow-600', buttonText: 'Book now' },
    { id: 3, badge: 'Up to $21 off', title: 'Get experts in 2 hours at $149', image: '/images/Facial.webp', bgColor: 'bg-blue-600', buttonText: 'Book now' },
    { id: 3, badge: 'Up to $21 off', title: 'Relax & rejuvenate at home', image: '/images/stressReliefMen.webp', bgColor: 'bg-gray-100', buttonText: 'Book now', textColor: 'text-black' },
  ]

  // Use 3 sets of items for the infinite illusion
  const items = [...promotions, ...promotions, ...promotions]

  const getCardWidth = useCallback(() => {
    const el = carouselRef.current
    if (!el || !el.children[0]) return 0
    const card = el.children[0]
    const style = window.getComputedStyle(el)
    const gap = parseInt(style.columnGap) || 0
    return card.offsetWidth + gap
  }, [])

  const handleScroll = useCallback(() => {
    const el = carouselRef.current
    if (!el) return

    const cardWidth = getCardWidth()
    const setWidth = promotions.length * cardWidth

    // If we scroll too far left into the first set, jump to the middle set
    if (el.scrollLeft <= setWidth * 0.5) {
      el.style.scrollBehavior = 'auto'
      el.scrollLeft += setWidth
    }
    // If we scroll too far right into the last set, jump to the middle set
    if (el.scrollLeft >= setWidth * 2) {
      el.style.scrollBehavior = 'auto'
      el.scrollLeft -= setWidth
    }
  }, [getCardWidth, promotions.length])

  const scroll = (direction) => {
    const el = carouselRef.current
    if (!el) return
    const cardWidth = getCardWidth()
    el.style.scrollBehavior = 'smooth'
    el.scrollBy({ left: direction === 'left' ? -cardWidth : cardWidth })
  }

  const startAutoScroll = useCallback(() => {
    stopAutoScroll()
    autoScrollRef.current = setInterval(() => {
      scroll('right')
    }, AUTO_SCROLL_INTERVAL)
  }, [getCardWidth])

  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      clearInterval(autoScrollRef.current)
      autoScrollRef.current = null
    }
  }

  // Initial position and Resize listener
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return

    const initPosition = () => {
      const cardWidth = getCardWidth()
      el.style.scrollBehavior = 'auto'
      el.scrollLeft = promotions.length * cardWidth
    }

    // Wait for layout
    const timer = setTimeout(initPosition, 100)
    window.addEventListener('resize', initPosition)
    
    startAutoScroll();

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', initPosition)
      stopAutoScroll()
    }
  }, [getCardWidth, promotions.length, startAutoScroll])

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

        <div
          className="relative group"
          onMouseEnter={stopAutoScroll}
          onMouseLeave={startAutoScroll}
        >
          <div
            ref={carouselRef}
            onScroll={handleScroll}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {items.map((promo, i) => (
              <PromoCard key={`${promo.id}-${i}`} promo={promo} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const PromoCard = ({ promo }) => (
  <div className={`${promo.bgColor} min-w-[90%] sm:min-w-130 snap-center rounded-2xl overflow-hidden shadow-sm shrink-0 transition-transform duration-300`}>
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
        <button
          className={`w-fit rounded-lg px-6 py-2.5 text-sm font-bold transition-all active:scale-95 ${
            promo.textColor ? 'bg-black text-white hover:bg-gray-800' : 'bg-white text-gray-900 hover:bg-gray-100'
          }`}
        >
          {promo.buttonText}
        </button>
      </div>

      <div className="h-44 sm:h-auto sm:w-1/2 relative">
        <img
          src={promo.image}
          alt={promo.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  </div>
)

export default Mid