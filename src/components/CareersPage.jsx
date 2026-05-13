import { Link } from 'react-router-dom';
import Footer from './Footer';
import PublicNavbar from './PublicNavbar';

const joinOptions = [
  'Join us as a Service Provider',
  'Join us as a Baker',
  'Join us as an Electrician',
];

const CareersPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <main className="mx-auto flex min-h-[58vh] max-w-6xl items-center justify-center px-4 py-16 sm:px-6">
        <section className="w-full rounded-lg border border-gray-200 bg-gray-50 px-5 py-12 text-center sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Careers</p>
          <h1 className="mt-3 text-3xl font-bold text-gray-950 sm:text-4xl">
            No job available for now.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
            Please check back later for open roles at My Local Force.
          </p>

          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {joinOptions.map((option) => (
              <Link
                key={option}
                to="/signup/provider"
                className="flex min-h-24 items-center justify-center rounded-lg border border-blue-100 bg-white px-4 py-5 text-sm font-semibold text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
              >
                {option}
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default CareersPage;
