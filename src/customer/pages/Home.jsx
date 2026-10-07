import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiTrash2, FiUser } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { fetchAllServices, fetchUserRoles } from '../../services/firebase';
import useCategories from '../../hooks/useCategories';
import SearchBar from '../components/SearchBar';
import StickySearchBar from '../components/StickySearchBar';
import VideoPlayer from '../components/VideoPlayer';
import CategoryGrid from '../components/CategoryGrid';
import BannerCarousel from '../components/BannerCarousel';
import HorizontalServiceCards from '../components/HorizontalServiceCards';
import HorizontalCategoryScroll from '../components/HorizontalCategoryScroll';
import NotificationBell from '../components/NotificationBell';
import Footer from '../../components/Footer';
import {
  categories as localCategories,
  salonSubCategoriesWomen,
  salonSubCategoriesMen,
} from '../../data/services';
import { notify, getUserFacingError } from '../../utils/toast';
import { clearCartDraft, getCartDraft } from '../../utils/cartDraft';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { categories: dbCategories, loading: loadingCategories } = useCategories();
  const [searchText, setSearchText] = useState('');
  const [isSearchSticky, setIsSearchSticky] = useState(false);
  const [mostBookedServices, setMostBookedServices] = useState([]);
  const [cartDraft, setCartDraft] = useState(null);

  // Use database categories if loaded, otherwise use local fallback for instant display
  const categories = dbCategories.length > 0 ? dbCategories : localCategories;

  // Fetch services from Firebase
  useEffect(() => {
    const loadServices = async () => {
      try {
        const services = await fetchAllServices();
        const formattedServices = services.slice(0, 10).map((service) => ({
          id: service.id,
          name: service.name,
          price: typeof service.price === 'number' ? service.price.toFixed(2) : service.price,
          rating: service.rating || '4.5',
          reviews: service.reviews || '0',
          image: service.imageUrl || '/images/womenSalon.png',
          imageFit: service.imageFit || 'cover',
          imagePositionX: service.imagePositionX ?? 50,
          imagePositionY: service.imagePositionY ?? 50,
          serviceData: service,
        }));
        setMostBookedServices(formattedServices);
      } catch (error) {
        console.error('Error loading services:', error);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
    const refreshCartDraft = () => setCartDraft(getCartDraft());
    refreshCartDraft();
    window.addEventListener('focus', refreshCartDraft);
    return () => window.removeEventListener('focus', refreshCartDraft);
  }, []);

  const handleResumeCart = () => {
    const draft = getCartDraft();
    if (!draft?.serviceData) return;
    navigate('/customer/booking', { state: draft });
  };

  const handleRemoveCart = () => {
    clearCartDraft();
    setCartDraft(null);
  };

  // Notification press handler
  const handleNotificationPress = () => {
    navigate('/customer/notifications');
  };

  // Get image URL for a category (handles Firebase URLs and local fallbacks)
  const getCategoryImage = (categoryNameOrObject) => {
    if (typeof categoryNameOrObject === 'object' && categoryNameOrObject !== null) {
      if (categoryNameOrObject.image && typeof categoryNameOrObject.image === 'string') {
        return categoryNameOrObject.image;
      }
      if (categoryNameOrObject.imageUrl) {
        return categoryNameOrObject.imageUrl;
      }
      categoryNameOrObject = categoryNameOrObject.name;
    }

    const categoryName = (categoryNameOrObject || '').toLowerCase();
    const imageMap = {
      'facial & skin': '/images/womenSalon.png',
      haircut: '/images/hair-cutting.webp',
      massage: '/images/massage.webp',
      'beauty therapy': '/images/makeup.webp',
      hairdressing: '/images/hairdresser.webp',
      'nail services': '/images/nail-artist.webp',
      'beard trim': '/images/beard-trimming.webp',
    };
    return imageMap[categoryName] || '/images/womenSalon.png';
  };

  // Banner images
  const banners = [
    { image: '/images/beardBanner.jpeg', name: "men's" },
    { image: '/images/facialBanner.jpeg', name: 'women' },
  ];

  // Navigation handlers
  const handleCategoryPress = (category) => {
    navigate('/customer/services', {
      state: { selectedCategory: category.name },
    });
  };

  const handleServicePress = (service) => {
    const serviceData = service.serviceData || service;
    navigate('/customer/services', {
      state: {
        fromHome: true,
        service: {
          id: serviceData.id,
          title: serviceData.name,
          description: serviceData.description,
          whatsIncluded:
            serviceData.whatsIncluded ||
            serviceData.whatIncluded ||
            serviceData.included ||
            serviceData.includes ||
            serviceData.features ||
            [],
          price: `$${
            typeof serviceData.price === 'number' ? serviceData.price.toFixed(2) : serviceData.price
          }`,
          duration: serviceData.duration,
          category: serviceData.category,
          categoryId: serviceData.category,
          provider: serviceData.ownerName || 'Service Provider',
          image: serviceData.imageUrl || '🏪',
          rating: serviceData.rating || '4.5',
          reviews: serviceData.reviews || '0',
          imageFit: serviceData.imageFit || 'cover',
          imagePositionX: serviceData.imagePositionX ?? 50,
          imagePositionY: serviceData.imagePositionY ?? 50,
          features: serviceData.features || serviceData.whatsIncluded || [serviceData.description],
          ownerName: serviceData.ownerName,
          ownerId: serviceData.ownerId,
          providers: serviceData.providers || [],
          imageUrl: serviceData.imageUrl,
        },
        searchQuery: serviceData.name,
      },
    });
  };

  const handleSubCategoryPress = (subcategory) => {
    navigate('/customer/services', {
      state: {
        searchQuery: subcategory.searchName,
      },
    });
  };

  const handleSearchSubmit = () => {
    if (searchText.trim()) {
      navigate('/customer/services', {
        state: { searchQuery: searchText.trim() },
      });
    }
  };

  const handleBannerPress = (banner, index) => {
    navigate('/customer/services', {
      state: { showFilters: true, bannerIndex: index, searchQuery: banner.name },
    });
  };

  // Sticky search on scroll
  const handleScroll = (e) => {
    const scrollY = e.currentTarget.scrollTop;
    setIsSearchSticky(scrollY > 120);
  };

  const handleSwitchRole = async () => {
    try {
      if (!isLoggedIn) {
        notify.info('Sign in to switch roles.', { id: 'home-switch-role' });
        navigate('/login');
        return;
      }
      const { roles } = await fetchUserRoles(user.uid);
      const availableRoles = Object.keys(roles || {}).filter((r) => roles[r]);

      if (availableRoles.length > 1) {
        navigate('/role-selection');
      } else {
        notify.warning('No other role is available for this account.', {
          id: 'home-switch-role',
        });
      }
    } catch (error) {
      notify.error(getUserFacingError(error, 'Could not check available roles.'), {
        id: 'home-switch-role',
      });
    }
  };

  return (
    <div className="flex-1 bg-slate-50 min-h-screen relative">
      {/* Sticky Search Bar */}
      <StickySearchBar
        isVisible={isSearchSticky}
        searchText={searchText}
        onSearchChange={setSearchText}
        onFilterPress={handleSearchSubmit}
        onSubmitEditing={handleSearchSubmit}
      />

      {/* For desktop */}
      <section className="relative h-screen w-full overflow-hidden lg:block hidden">
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
                We endeavor to comprehend what they're going through, what they need and what their
                price tags are.
              </p>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
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

      <div className="overflow-y-auto h-full" onScroll={handleScroll}>
        <div className="w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 bg-white mb-3 sm:mb-4 shadow-sm lg:hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="shrink min-w-0">
                {/* Role Indicator */}
                <button
                  onClick={handleSwitchRole}
                  className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-2 py-1 rounded-2xl mb-2 self-start hover:bg-blue-100 active:bg-blue-200 transition-colors"
                  aria-label="Current role: Customer"
                >
                  <FiUser className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-[10px] sm:text-xs font-semibold text-blue-700">
                    Customer
                  </span>
                </button>

                {/* Greeting */}
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 truncate">
                  Hey{' '}
                  {isLoggedIn
                    ? user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User'
                    : 'Mate!'}
                </h1>
              </div>

              {/* Header Buttons */}
              <div className="flex items-center ml-4">
                {isLoggedIn ? (
                  <NotificationBell
                    onPress={handleNotificationPress}
                    size={20}
                    color="#5A52E3"
                    role="customer"
                    bgColor="#F3F5FF"
                  />
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="bg-primary-600 text-white px-3 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold hover:bg-primary-700 active:bg-primary-800 transition-colors whitespace-nowrap"
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm sm:text-base text-slate-500">
              Find the perfect service at your home.
            </p>
          </div>

          {/* Search Bar */}
          <SearchBar
            searchText={searchText}
            onSearchChange={setSearchText}
            onFilterPress={handleSearchSubmit}
            onSubmitEditing={handleSearchSubmit}
          />

          {/* Video Section */}
          <VideoPlayer
            source="https://firebasestorage.googleapis.com/v0/b/mylocalforce-295b8.firebasestorage.app/o/video%2Fsalon_video.mp4?alt=media&token=1feeb637-5a50-4f32-a34b-0751ab158280"
            poster="/images/salon_poster.png"
          />

          {/* Categories Section */}
          <CategoryGrid
            categories={categories}
            onCategoryPress={handleCategoryPress}
            getCategoryImage={getCategoryImage}
            loading={loadingCategories}
          />

          {/* Banner Carousel */}
          <BannerCarousel banners={banners} onBannerPress={handleBannerPress} />

          {/* Most Booked Services */}
          <HorizontalServiceCards
            title="Most booked services"
            services={mostBookedServices.slice(0, 5)}
            onServicePress={handleServicePress}
            showDiscount={true}
          />

          {/* Salon for Women */}
          <HorizontalCategoryScroll
            title="Salon for Women"
            subCategories={salonSubCategoriesWomen}
            onSubCategoryPress={handleSubCategoryPress}
          />

          {/* Massage */}
          <HorizontalCategoryScroll
            title="Massage"
            subCategories={salonSubCategoriesMen}
            onSubCategoryPress={handleSubCategoryPress}
          />

          {/* Bottom spacing for mobile tab bar */}
          <div className="h-4 sm:h-8" />
        </div>

        <Footer />
      </div>
      {cartDraft?.serviceData ? (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
          <button
            type="button"
            onClick={handleResumeCart}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-200 transition hover:bg-indigo-700"
            aria-label="Go to cart"
          >
            <FiShoppingCart className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={handleRemoveCart}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white text-red-600 shadow-lg transition hover:bg-red-50"
            aria-label="Remove cart"
          >
            <FiTrash2 className="h-5 w-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default HomeScreen;
