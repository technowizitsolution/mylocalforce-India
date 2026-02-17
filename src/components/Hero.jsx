import { useNavigate } from "react-router-dom"
export default function Hero() {
  
  const navigate = useNavigate();
  const isClient = typeof navigator !== 'undefined'
  const userAgent = isClient ? navigator.userAgent : ''
  const isIOS =
    isClient &&
    (/iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  const isAndroid = isClient && /Android/.test(userAgent)

  const handleRedirect = () => {
    if (isIOS) {
      window.open(
        "https://apps.apple.com/in/app/mylocalforce/id6757386095",
        "_blank"
      )
    } else if (isAndroid) {
      window.open(
        "https://play.google.com/store/apps/details?id=com.mylocalforceapp&pcampaignid=web_share",
        "_blank"
      )
    } else {
      window.open(
        "https://play.google.com/store/apps/details?id=com.mylocalforceapp&pcampaignid=web_share",
        "_blank"
      )
    }
  }

  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Background Image */}
      <img
        src="/images/Nail1.jpg"
        alt="Salon"
        className="absolute inset-0 h-full w-full object-cover md:hidden"
      />
      <img
        src="/images/Nail2.jpg"
        alt="Salon"
        className="absolute inset-0 h-full w-full object-cover hidden md:block"
      />

      <div className="absolute inset-0 bg-black/40"></div>

      <div className="relative z-10 h-full flex flex-col">
        {/* Navbar */}
        <nav className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 md:px-8 lg:px-12 py-4 sm:py-6 gap-4 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src="/images/MLF.jpg" alt="Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded" />
            <p className="text-white text-lg sm:text-xl md:text-2xl font-bold">
              MY LOCAL FORCE
            </p>
          </div>

          <div className="flex flex-row items-center gap-4 p-5">
            <button
              onClick={handleRedirect}
              className="border border-white px-5 sm:px-6 py-2.5 rounded-full text-sm sm:text-base font-semibold hover:bg-blue-600 text-white transition cursor-pointer"
            >
              Get Our App
            </button>

            <button
              onClick={() => navigate('/login')}
              className="border border-white px-5 sm:px-6 py-2.5 rounded-full text-sm sm:text-base font-semibold text-white hover:bg-[#2969E7] hover:text-white transition cursor-pointer"
            >
              Login
            </button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex items-center px-4 sm:px-6 md:px-8 lg:px-12">
          <div className="max-w-2xl text-white">
            <p className="text-gray-200 font-bold text-xs sm:text-sm mb-2 sm:mb-4 tracking-widest">
              — FAST AND RELIABLE
            </p>

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4 sm:mb-6">
              Your affordable <br /> Home service
            </h1>

            <p className="text-gray-200 text-sm sm:text-base md:text-lg mb-6 sm:mb-10 max-w-xl">
              We endeavor to comprehend what they're going through, what they need and what their price tags are.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
              <div className="flex flex-row sm:flex-col gap-2 sm:gap-3 md:gap-4">
                <a
                  href="https://apps.apple.com/in/app/mylocalforce/id6757386095"
                  className="inline-block transition-transform duration-300 hover:scale-105"
                >
                  <img
                    src="/images/appStore.webp"
                    alt="Download on App Store"
                    className="h-7 sm:h-8 md:h-10 w-auto object-contain"
                  />
                </a>

                <a
                  href="https://play.google.com/store/apps/details?id=com.mylocalforceapp&pcampaignid=web_share"
                  className="inline-block transition-transform duration-300 hover:scale-105"
                >
                  <img
                    src="/images/googlePlay.webp"
                    alt="Get it on Google Play"
                    className="h-7 sm:h-8 md:h-10 w-auto object-contain"
                  />
                </a>
              </div>

              <a
                href="#"
                className="text-white text-sm sm:text-base font-semibold hover:text-[#2969E7] transition flex items-center gap-2"
              >
                Check All Services →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}