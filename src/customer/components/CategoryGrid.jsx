import React from 'react';

const CategoryGrid = ({
  categories = [],
  onCategoryPress,
  getCategoryImage,
  showTitle = true,
  title = 'Our Services',
  loading = false,
}) => {
  const handleCategoryPress = (category) => {
    if (onCategoryPress) {
      onCategoryPress(category);
    }
  };

  const getImageSrc = (category) => {
    if (getCategoryImage) return getCategoryImage(category);
    if (category.image && typeof category.image === 'string') return category.image;
    if (category.imageUrl) return category.imageUrl;
    return '/placeholder.png';
  };

  const showLoading = loading && categories.length === 0;

  return (
    <div className="mb-6 sm:mb-8">

      {/* Header Section */}
        <div className="mb-10 mt-10 sm:mb-14 md:mb-20 text-center lg:block hidden">
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

      {showTitle && (
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mx-4 sm:mx-6 lg:mx-8 mb-3 sm:mb-4 sm:hidden lg:hidden">
          {title}
        </h2>
      )}

      {showLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-indigo-500" />
        </div>
      ) : (
        categories.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryPress(category)}
                className="flex items-center justify-between bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-800 flex-1 pr-2">
                  {category.name}
                </span>
                <img
                  src={getImageSrc(category)}
                  alt={category.name}
                  className="w-10 h-10 sm:w-12 sm:h-12 object-contain shrink-0"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default CategoryGrid;