import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiChevronDown } from 'react-icons/fi';
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
import {
  categories as localCategories,
  salonSubCategoriesWomen,
  salonSubCategoriesMen,
} from '../../data/services';

const HomeScreen = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const { categories: dbCategories, loading: loadingCategories } = useCategories();
  const [searchText, setSearchText] = useState('');
  const [isSearchSticky, setIsSearchSticky] = useState(false);
  const [mostBookedServices, setMostBookedServices] = useState([]);

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
          price:
            typeof service.price === 'number'
              ? service.price.toFixed(2)
              : service.price,
          rating: service.rating || '4.5',
          reviews: service.reviews || '0',
          image: service.imageUrl || '/images/womenSalon.png',
          serviceData: service,
        }));
        setMostBookedServices(formattedServices);
      } catch (error) {
        console.error('Error loading services:', error);
      }
    };

    loadServices();
  }, []);

  // Notification press handler
  const handleNotificationPress = () => {
    // TODO: navigate to notifications page when implemented
    console.log('Notification bell pressed');
  };

  // Get image URL for a category (handles Firebase URLs and local fallbacks)
  const getCategoryImage = (categoryNameOrObject) => {
    if (
      typeof categoryNameOrObject === 'object' &&
      categoryNameOrObject !== null
    ) {
      if (
        categoryNameOrObject.image &&
        typeof categoryNameOrObject.image === 'string'
      ) {
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
    '/images/beardBanner.jpeg',
    '/images/facialBanner.jpeg',
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
          price: `$${
            typeof serviceData.price === 'number'
              ? serviceData.price.toFixed(2)
              : serviceData.price
          }`,
          duration: serviceData.duration,
          category: serviceData.category,
          categoryId: serviceData.category,
          provider: serviceData.ownerName || 'Service Provider',
          image: serviceData.imageUrl || '🏪',
          rating: serviceData.rating || '4.5',
          reviews: serviceData.reviews || '0',
          features: serviceData.features || [serviceData.description],
          ownerName: serviceData.ownerName,
          ownerEmail: serviceData.ownerEmail,
          ownerPhone: serviceData.ownerPhone,
          ownerId: serviceData.ownerId,
          providers: serviceData.providers || [],
          imageUrl: serviceData.imageUrl,
        },
      },
    });
  };

  const handleSubCategoryPress = (subcategory) => {
    navigate('/customer/services', {
      state: {
        selectedCategory: subcategory.category || subcategory.name,
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
      state: { showFilters: true, bannerIndex: index },
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
        alert('Please login to switch roles');
        return;
      }
      const { roles } = await fetchUserRoles(user.uid);
      const availableRoles = Object.keys(roles || {}).filter((r) => roles[r]);

      if (availableRoles.length > 1) {
        // TODO: navigate to role selection page when implemented
        console.log('Multiple roles available:', availableRoles);
      } else {
        alert('You only have one role.');
      }
    } catch (error) {
      alert('Failed to check available roles');
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

      <div
        className="overflow-y-auto h-full"
        onScroll={handleScroll}
      >
        <div className="w-full max-w-7xl mx-auto">
          {/* Header */}
          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 bg-white mb-3 sm:mb-4 shadow-sm">
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
                  <FiChevronDown className="w-3 h-3 text-blue-600" />
                </button>

                {/* Greeting */}
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-800 truncate">
                  Hey{' '}
                  {isLoggedIn
                    ? user?.name?.split(' ')[0] ||
                      user?.email?.split('@')[0] ||
                      'User'
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
      </div>
    </div>
  );
};

export default HomeScreen;
