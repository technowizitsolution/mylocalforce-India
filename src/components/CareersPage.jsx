import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronDown, FiSearch } from 'react-icons/fi';
import Footer from './Footer';
import PublicNavbar from './PublicNavbar';

const serviceCategories = [
  'Accounting & Financial Services',
  'Air Conditioning',
  'Antenna & TV Services',
  'Appliance Installation',
  'Appliance Repairs',
  'Architecture & Design',
  'Asbestos Removal',
  'Asphalt & Driveways',
  'Attic & Roof Access',
  'Auto & Vehicle Services',
  'Awnings & Shade Sails',
  'Balustrades & Handrails',
  'Bathroom Renovations',
  'Beauty & Personal Care',
  'Beds & Bedroom Furniture',
  'Blinds & Curtains',
  'Bricklaying & Masonry',
  'Building & Construction',
  'Cabinet Making & Joinery',
  'Carpentry',
  'Carpet & Flooring',
  'Catering & Food',
  'Ceilings & Plaster',
  'Childcare & Education',
  'Chimney Services',
  'Cladding',
  'Cleaning Services',
  'Clothesline & Outdoor Fixtures',
  'Clothing & Alterations',
  'Computers & IT',
  'Concrete Work',
  'Curtains & Window Furnishings',
  'Damp Proofing & Moisture Control',
  'Decking',
  'Delivery & Courier',
  'Demolition',
  'Dog & Pet Care',
  'Doors & Windows',
  'Drafting & Plans',
  'Electrical',
  'Equipment Hire',
  'Events & Entertainment',
  'Excavation & Earthworks',
  'Fencing',
  'Feng Shui Consulting',
  'Fireplaces & Heating',
  'Fitness & Wellness',
  'Flooring - See also Carpet & Flooring',
  'Flyscreens & Security Screens',
  'Frames & Trusses',
  'Furniture - Custom & Repairs',
  'Garage & Shed',
  'Garden & Landscaping',
  'Gas Fitting',
  'Gates',
  'Gazebos & Outdoor Structures',
  'Glass & Glazing',
  'Guttering & Stormwater',
  'Handyman Services',
  'Home Automation & Smart Home',
  'Home Inspections & Reports',
  'Home Theatre & AV',
  'Hot Water Systems',
  'IKEA & Flat-Pack Furniture',
  'Insulation',
  'Interior Design & Decorating',
  'Irrigation - see Garden & Landscaping',
  'Joinery',
  'Kitchen Renovations',
  'Landscaping & Paving',
  'Legal Services',
  'Lifts & Elevators',
  'Lighting',
  'Locksmiths',
  'Louvre Roofs',
  'Marketing & Business',
  'Mirrors & Marble',
  'Nurseries & Plant Supply',
  'Painting',
  'Patios, Pergolas & Decks',
  'Pest Control',
  'Plastering & Rendering',
  'Playground Equipment',
  'Plumbing',
  'Pool & Spa',
  'Pressure Cleaning',
  'Privacy Screens',
  'Professional Organising',
  'Project Management (Building)',
  'Rainwater Tanks',
  'Real Estate',
  'Removalists',
  'Rendering - see Plastering & Rendering',
  'Retaining Walls',
  'Roofing',
  'Rubbish Removal',
  'Saunas & Outdoor Living',
  'Scaffolding',
  'Security',
  'Shade Structures',
  'Sheds & Storage',
  'Shopfitting & Office Fitout',
  'Shower Screens',
  'Skylights',
  'Solar & Energy',
  'Splashbacks',
  'Staffing & Labour Hire',
  'Staircases',
  'Stone & Masonry',
  'Surveyors & Town Planning',
  'Tiling',
  'Translation Services',
  'Tree Services',
  'Underpinning & Foundations',
  'Upholstery',
  'Vacuum Systems',
  'Ventilation',
  'Verandahs',
  'Wallpapering',
  'Wardrobes & Storage',
  'Water Features',
  'Waterproofing',
  'Window Cleaning',
  'Wine Racks & Specialty Joinery',
];

const featuredCategories = [
  'Cleaning Services',
  'Electrical',
  'Plumbing',
  'Beauty & Personal Care',
];

const getSignupLink = (category) =>
  `/signup/provider?category=${encodeURIComponent(category)}`;

const CategoryLink = ({ category }) => (
  <Link
    to={getSignupLink(category)}
    state={{ selectedProviderCategory: category }}
    className="group flex min-h-12 items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
    aria-label={`Join us as a ${category} provider`}
  >
    <span className="min-w-0 leading-5">Join us as a {category}</span>
  </Link>
);

const CareersPage = () => {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return serviceCategories;
    }

    return serviceCategories.filter((category) => category.toLowerCase().includes(query));
  }, [searchTerm]);

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <main className="mx-auto flex min-h-[58vh] max-w-6xl items-center justify-center px-4 py-16 sm:px-6">
        <section className="w-full rounded-lg border border-gray-200 bg-gray-50 px-5 py-12 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Careers</p>
            <h1 className="mt-3 text-3xl font-bold text-gray-950 sm:text-4xl">
              No job available for now.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
              Please check back later for open roles at My Local Force.
            </p>
            <h2 className="mt-8 text-xl font-bold text-gray-950 sm:text-2xl">
              Join us as a service provider
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
              Select your category to continue to provider signup.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-4xl">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {featuredCategories.map((category) => (
                <CategoryLink key={category} category={category} />
              ))}

              <button
                type="button"
                onClick={() => setShowAllCategories((current) => !current)}
                className="group flex min-h-12 items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-600 px-3 py-2.5 text-left text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-2"
                aria-expanded={showAllCategories}
              >
                <span>Other categories</span>
                <FiChevronDown
                  className={`h-4 w-4 shrink-0 transition ${
                    showAllCategories ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            {showAllCategories ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <label className="relative block">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search category"
                    className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </label>

                <div className="mt-4 max-h-[32rem] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((category) => (
                        <CategoryLink key={category} category={category} />
                      ))
                    ) : (
                      <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-4 text-sm font-semibold text-gray-500 sm:col-span-2 lg:col-span-3">
                        No categories found.
                      </p>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold text-gray-500">
                  Showing {filteredCategories.length} of {serviceCategories.length} categories
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CareersPage;
