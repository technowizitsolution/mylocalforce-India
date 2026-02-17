// Dummy data for categories and services
// Using public image paths for web
// Grouping salon-related categories under a single main category `Salon & Beauty`
export const categories = [
  {
    id: 1,
    name: 'Salon & Beauty',
    image: '/images/womenSalon.png',
    color: '#E91E63',
    description: 'All salon and beauty related services',
    subcategories: [
      {
        id: 101,
        name: 'Facial & Skin',
        image: '/images/womenSalon.png',
        color: '#E91E63',
        description: 'Beauty and grooming services for women',
      },
      {
        id: 102,
        name: 'Haircut',
        image: '/images/hair-cutting.webp',
        color: '#3F51B5',
        description: 'Professional haircut services',
      },
      {
        id: 103,
        name: 'Massage',
        image: '/images/massage.webp',
        color: '#00BCD4',
        description: 'Relaxing massage services',
      },
      {
        id: 104,
        name: 'Beauty Therapy',
        image: '/images/makeup.webp',
        color: '#4CAF50',
        description: 'Professional beauty therapy services',
      },
      {
        id: 105,
        name: 'Hairdressing',
        image: '/images/hairdresser.webp',
        color: '#FF9800',
        description: 'Expert hairdressing services',
      },
      {
        id: 106,
        name: 'Nail Services',
        image: '/images/nail-artist.webp',
        color: '#2196F3',
        description: 'Professional nail care services',
      },
      {
        id: 107,
        name: 'Beard Trim',
        image: '/images/beard-trimming.webp',
        color: '#9C27B0',
        description: 'Professional beard trimming services',
      },
    ],
  },
];

// Flattened list of subcategories for backward compatibility with components
export const flatCategories = categories.reduce((acc, cat) => {
  if (Array.isArray(cat.subcategories)) {
    return acc.concat(cat.subcategories);
  }
  return acc;
}, []);

// Most booked services data
export const mostBookedServices = [
  {
    id: 1,
    name: 'bathroom cleaning',
    image: '/images/bathroomClean.webp',
    rating: 4.79,
    reviews: '3M',
    price: 75,
    originalPrice: null,
    discount: null,
  },
  {
    id: 2,
    name: 'AC service',
    image: '/images/acClean.png',
    rating: 4.79,
    reviews: '3M',
    price: 60,
    originalPrice: 100,
    discount: 8,
  },
  {
    id: 3,
    name: 'Drill & hang',
    image: '/images/drill.webp',
    rating: 4.77,
    reviews: '1.8M',
    price: 40,
    originalPrice: null,
    discount: null,
  },
];

// Salon subcategories data
export const salonSubCategoriesWomen = [
  {
    id: 1,
    name: 'Waxing',
    image: '/images/Waxing.webp',
    category: 'Beauty Therapy',
  },
  {
    id: 2,
    name: 'Facial',
    image: '/images/Cleanup.webp',
    category: 'Facial & Skin',
  },
  {
    id: 3,
    name: 'Nail Services',
    image: '/images/Facial.webp',
    category: 'Nail Services',
  },
  {
    id: 4,
    name: 'Hair Care',
    image: '/images/HairCare.webp',
    category: 'Hairdressing',
  },
  {
    id: 5,
    name: 'Stress Relief',
    image: '/images/stressReliefWomen.webp',
    category: 'Massage',
  },
  {
    id: 6,
    name: 'Pain Relief',
    image: '/images/painReliefWomen.webp',
    category: 'Massage',
  },
];

// Salon subcategories data
export const salonSubCategoriesMen = [
  {
    id: 1,
    name: 'Stress Relief',
    image: '/images/stressReliefMen.webp',
    category: 'Massage',
  },
  {
    id: 2,
    name: 'Pain Relief',
    image: '/images/painReliefMen.webp',
    category: 'Massage',
  },
];

// Cleaning subcategories data
export const cleaningSubCategories = [
  {
    id: 1,
    name: 'Bathroom',
    image: '/images/cleaning.png',
    category: 'Cleaning',
  },
  {
    id: 2,
    name: 'Kitchen',
    image: '/images/cleaning.png',
    category: 'Cleaning',
  },
  {
    id: 3,
    name: 'Full Home',
    image: '/images/cleaning.png',
    category: 'Cleaning',
  },
  {
    id: 4,
    name: 'Sofa',
    image: '/images/cleaning.png',
    category: 'Cleaning',
  },
];

export const popularServices = [
  {
    id: 1,
    title: 'Home Deep Cleaning',
    category: 'Cleaning',
    categoryId: 1,
    price: '$50',
    rating: 4.8,
    reviews: 245,
    duration: '2-3 hours',
    description: 'Complete deep cleaning of your home including all rooms, kitchen, and bathrooms. Our professional cleaners use eco-friendly products and ensure every corner is spotless.',
    image: '🏠',
    provider: 'CleanPro Services',
    features: ['Eco-friendly products', 'Insured professionals', 'Quality guarantee']
  },
  {
    id: 2,
    title: 'Emergency Plumbing Repair',
    category: 'Plumbing',
    categoryId: 2,
    price: '$75',
    rating: 4.6,
    reviews: 189,
    duration: '1-2 hours',
    description: 'Quick and reliable emergency plumbing services for leaks, clogs, and repairs. Available 24/7 with experienced plumbers.',
    image: '🚰',
    provider: 'QuickFix Plumbing',
    features: ['24/7 availability', 'Licensed plumbers', 'Warranty included']
  },
  {
    id: 3,
    title: 'Electrical Installation',
    category: 'Electrician',
    categoryId: 3,
    price: '$60',
    rating: 4.7,
    reviews: 156,
    duration: '1-3 hours',
    description: 'Professional electrical installation and repair services. From ceiling fans to complete wiring, our certified electricians handle it all.',
    image: '💡',
    provider: 'PowerLine Electric',
    features: ['Certified electricians', 'Safety guaranteed', 'Free estimates']
  },
  {
    id: 4,
    title: 'Hair & Makeup at Home',
    category: 'Salon',
    categoryId: 4,
    price: '$40',
    rating: 4.9,
    reviews: 320,
    duration: '1-2 hours',
    description: 'Professional hair styling and makeup services at your home. Perfect for special occasions, parties, or just to pamper yourself.',
    image: '💇‍♀️',
    provider: 'Glamour Home Studio',
    features: ['Professional stylists', 'Premium products', 'Flexible timing']
  }
];

export const allServices = [
  ...popularServices,
  {
    id: 5,
    title: 'Bathroom Cleaning',
    category: 'Cleaning',
    categoryId: 1,
    price: '$25',
    rating: 4.5,
    reviews: 98,
    duration: '1 hour',
    description: 'Specialized bathroom cleaning service with disinfection and deep scrubbing.',
    image: '🛁',
    provider: 'Sparkle Clean',
    features: ['Deep disinfection', 'Scrub & shine', 'Affordable pricing']
  },
  {
    id: 6,
    title: 'Kitchen Sink Repair',
    category: 'Plumbing',
    categoryId: 2,
    price: '$45',
    rating: 4.4,
    reviews: 76,
    duration: '1 hour',
    description: 'Kitchen sink repairs including faucet installation and leak fixes.',
    image: '🚿',
    provider: 'Home Plumbing Co.',
    features: ['Quick service', 'Quality parts', 'Clean workspace']
  },
  {
    id: 7,
    title: 'Ceiling Fan Installation',
    category: 'Electrician',
    categoryId: 3,
    price: '$35',
    rating: 4.6,
    reviews: 134,
    duration: '45 minutes',
    description: 'Professional ceiling fan installation with proper wiring and balancing.',
    image: '🌀',
    provider: 'Fan Masters',
    features: ['Expert installation', 'Proper balancing', 'Warranty included']
  },
  {
    id: 8,
    title: 'Bridal Makeup',
    category: 'Salon',
    categoryId: 4,
    price: '$80',
    rating: 5.0,
    reviews: 89,
    duration: '2-3 hours',
    description: 'Complete bridal makeup package with trial session and touch-up kit.',
    image: '👰',
    provider: 'Elite Bridal Services',
    features: ['Trial session', 'Touch-up kit', 'HD makeup']
  }
];
