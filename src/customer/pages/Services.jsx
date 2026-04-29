import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import {
  FiSearch,
  FiFilter,
  FiClock,
  FiChevronRight,
  FiScissors,
  FiHome,
  FiWind,
  FiZap,
  FiLock,
  FiDroplet,
  FiUser,
  FiSettings,
} from 'react-icons/fi';
import { fetchAllServices, subscribeToAllServices } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import useCategories from '../../hooks/useCategories';

const Services = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const { categories } = useCategories();

  // Initialise from navigation state (Home screen passes selectedCategory / searchQuery)
  const incomingCategory = location.state?.selectedCategory || 'All';
  const incomingSearch = location.state?.searchQuery || '';

  const [searchText, setSearchText] = useState(incomingSearch);
  const [selectedCategory, setSelectedCategory] = useState(incomingCategory);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Respond to new navigation state (e.g. user navigates from Home again)
  useEffect(() => {
    if (location.state?.selectedCategory) {
      setSelectedCategory(location.state.selectedCategory);
    }
    if (location.state?.searchQuery) {
      setSearchText(location.state.searchQuery);
    }
  }, [location.state]);

  // Create category filters from main categories
  const categoryFilters = useMemo(() => {
    if (!categories || categories.length === 0) return ['All'];
    return ['All', ...categories.map(cat => typeof cat === 'string' ? cat : cat.name)];
  }, [categories]);

  // Load services once
  const loadServicesOnce = useCallback(async () => {
    try {
      const fetchedServices = await fetchAllServices();
      setServices(fetchedServices);
    } catch (error) {
      console.error('Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Set up real-time updates
  useEffect(() => {
    let unsubscribe = null;

    const setupRealTimeUpdates = async () => {
      try {
        unsubscribe = subscribeToAllServices((updatedServices) => {
          setServices(updatedServices);
          setLoading(false);
          setRefreshing(false);
        });
      } catch (error) {
        console.error('Error setting up real-time updates:', error);
        await loadServicesOnce();
      }
    };

    setupRealTimeUpdates();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [loadServicesOnce]);

  const getServiceIcon = (category) => {
    const iconMap = {
      'woman salon': <FiScissors className="w-6 h-6" />,
      'beauty therapy': <FiHome className="w-6 h-6" />,
      'massage': <FiWind className="w-6 h-6" />,
      'electrician plumber and carpenters': <FiZap className="w-6 h-6" />,
      'beard trim': <FiLock className="w-6 h-6" />,
      'native water': <FiDroplet className="w-6 h-6" />,
      'massage for man': <FiUser className="w-6 h-6" />,
    };
    return iconMap[category?.toLowerCase()] || <FiSettings className="w-6 h-6" />;
  };

  const filteredServices = services.filter(service => {
    const matchesSearch =
      service.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      service.category?.toLowerCase().includes(searchText.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchText.toLowerCase());

    if (selectedCategory === 'All') {
      return matchesSearch;
    }

    return service.category === selectedCategory && matchesSearch;
  });

  const handleViewDetails = (service) => {
    const normalized = {
      id: service.id,
      title: service.name || service.title,
      description: service.description,
      price: typeof service.price === 'number' ? service.price : parseFloat(String(service.price).replace(/[^0-9.]/g, '')) || 0,
      duration: service.duration,
      category: service.category,
      categoryId: service.categoryId || service.category,
      provider: service.ownerName || service.provider || 'Service Provider',
      image: service.imageUrl || service.image || '🏪',
      rating: service.rating || null,
      reviews: service.reviews || null,
      features: service.features || [service.description],
      ownerName: service.ownerName || null,
      ownerEmail: service.ownerEmail || null,
      ownerPhone: service.ownerPhone || null,
      ownerId: service.ownerId || null,
      providers: service.providers || (service.ownerId ? [service.ownerId] : []),
      imageUrl: service.imageUrl,
    };

    navigate('/customer/service-detail', { state: { service: normalized } });
  };

  const handleBookNow = (item) => {
    if (!isLoggedIn) {
      navigate('/login', { state: { redirectTo: '/customer/address' } });
      return;
    }

    const numericPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;

    navigate('/customer/address', {
      state: {
        serviceData: {
          id: item.id,
          name: item.name,
          description: item.description,
          price: numericPrice,
          duration: item.duration,
          category: item.category,
          ownerId: item.ownerId,
          ownerName: item.ownerName,
          ownerEmail: item.ownerEmail,
          ownerPhone: item.ownerPhone,
          imageUrl: item.imageUrl,
          providers: item.providers || [],
        },
        packageData: {
          name: item.name,
          price: `$${numericPrice.toFixed(2)}`,
          duration: item.duration,
          services: [item.description || item.name],
        },
      },
    });
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadServicesOnce();
  }, [loadServicesOnce]);

  return (
    <>
      {/* Desktop */}
      <div className='hidden lg:block flex-1 bg-slate-50 min-h-screen'>
        {/* Header */}
        <div className="sticky top-0 z-10 overflow-hidden">

          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-slate-50"></div>

          {/* Navigation Content */}
          <nav className="relative z-10 flex flex-col sm:flex-row items-center justify-between lg:px-30 py-1 sm:py-2 gap-4 ">
            {/* Logo Section */}
            <div onClick={()=>navigate('/customer')} className="flex items-center gap-2 sm:gap-3 cursor-pointer">
              <img src="/images/MLF.jpg" alt="Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg border border-blue-100" />
              <p className="text-[#5A52E3] text-lg sm:text-xl md:text-2xl font-bold">
                MY LOCAL FORCE
              </p>
            </div>

            {/* Right Section */}
            <div className="flex flex-row items-center gap-3 sm:gap-4">

              <div className="flex-1 flex items-center gap-2 px-4 py-2 border border-blue-100 rounded-lg bg-slate-50">
                <FiSearch className="text-gray-400 w-5 h-5" color='#5A52E3'/>
                <input
                  type="text"
                  placeholder="Search for services..."
                  className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-gray-400"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              {isLoggedIn && (
                <NotificationBell
                  onPress={() => navigate('/customer/notifications')}
                  size={20}
                  color="#5A52E3"
                  role="customer"
                  bgColor="white"
                />
              )}

              <button
                onClick={() => navigate("/customer/profile")}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-md bg-white hover:bg-gray-100 active:bg-gray-200 transition-colors cursor-pointer border border-blue-100"
              >
                <FiUser className="w-5 h-5 text-[#5A52E3]" />
              </button>
            </div>
          </nav>
        </div>

        {/* Services Content */}
        <div className="px-6 py-6">
          <div className="max-w-7xl mx-auto">
            {/* Category Filters */}
            <div className="mb-6">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categoryFilters.map((category, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${selectedCategory === category
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-700 border border-gray-200 hover:border-indigo-300'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Services Grid */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600">Loading services...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FiSearch className="w-12 h-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-bold text-slate-800 mb-2">No services found</h3>
                <p className="text-slate-600">Try adjusting your search or category filter</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredServices.map((service) => (
                    <div key={service.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                      {/* Service Image */}
                      <div className="h-40 bg-indigo-100 flex items-center justify-center overflow-hidden">
                        {service.imageUrl ? (
                          <img
                            src={service.imageUrl}
                            alt={service.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-indigo-600">
                            {getServiceIcon(service.category)}
                          </div>
                        )}
                      </div>

                      {/* Service Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-slate-800 mb-1">{service.name}</h3>
                        <p className="text-xs text-slate-500 mb-2">{service.category}</p>

                        <div className="flex items-center gap-1 text-slate-600 mb-3">
                          <FiClock className="w-4 h-4" />
                          <span className="text-xs">{service.duration}</span>
                        </div>

                        <div className="border-t border-gray-100 pt-3 mb-3">
                          <p className="text-lg font-bold text-indigo-600">
                            ${typeof service.price === 'number' ? service.price.toFixed(2) : service.price}
                          </p>
                          <p className="text-xs text-slate-400">onwards</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleViewDetails(service)}
                            className="flex-1 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium text-sm border border-indigo-200"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleBookNow(service)}
                            className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                          >
                            Book
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Refresh button */}
                {!loading && filteredServices.length > 0 && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={onRefresh}
                      disabled={refreshing}
                      className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors font-medium"
                    >
                      {refreshing ? 'Refreshing...' : 'Refresh Services'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile and tablet */}
      <div className="block lg:hidden flex-1 bg-slate-50 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800">All Services</h2>
            <p className="text-sm text-slate-500 mt-1">
              {filteredServices.length} services available{refreshing ? ' • Refreshing...' : ''}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex gap-4">
            <div className="flex-1 flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg bg-slate-50">
              <FiSearch className="text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search for services..."
                className="flex-1 bg-transparent outline-none text-sm text-slate-800 placeholder-gray-400"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <button className="p-3 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors">
              <FiFilter className="text-indigo-600 w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto pb-2">
            {categoryFilters.map((category, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Services List */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-slate-600">Loading services...</p>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FiSearch className="w-12 h-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">No services found</h3>
              <p className="text-slate-600">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredServices.map((service) => (
                <div key={service.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  {/* Service Header */}
                  <div className="flex gap-4 mb-4">
                    {/* Icon/Image */}
                    <div className="shrink-0">
                      {service.imageUrl ? (
                        <img
                          src={service.imageUrl}
                          alt={service.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                          {getServiceIcon(service.category)}
                        </div>
                      )}
                    </div>

                    {/* Service Info */}
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">{service.name}</h3>
                      <p className="text-sm text-slate-500">{service.category}</p>
                      <div className="flex items-center gap-1 mt-1 text-slate-600">
                        <FiClock className="w-4 h-4" />
                        <span className="text-xs">{service.duration}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-indigo-600 text-lg">
                        ${typeof service.price === 'number' ? service.price.toFixed(2) : service.price}
                      </p>
                      <p className="text-xs text-slate-500">onwards</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleViewDetails(service)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium text-sm"
                    >
                      View Details
                      <FiChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleBookNow(service)}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
                    >
                      Book Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Refresh button */}
          {!loading && filteredServices.length > 0 && (
            <div className="flex justify-center mt-6">
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors font-medium"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Services'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Services;
