import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiDollarSign,
  FiMapPin,
  FiMessageSquare,
  FiShield,
  FiSmartphone,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import Footer from './Footer';
import PublicNavbar from './PublicNavbar';

const customerFlow = [
  {
    title: 'Post a job in under two minutes',
    description:
      'Describe what you need, your location, and your preferred timing. Qualified local professionals can review your request right away.',
  },
  {
    title: 'Receive and compare genuine quotes',
    description:
      'Review verified profiles, previous ratings, and clear pricing side by side so you can choose with confidence.',
  },
  {
    title: 'Book, chat, and complete in one place',
    description:
      'Scheduling, communication, and updates stay inside the platform from first message through job completion.',
  },
];

const professionalFlow = [
  {
    title: 'Build a profile that reflects your trade',
    description:
      'Showcase your services, service area, experience, and previous work to attract local customers who need your exact skills.',
  },
  {
    title: 'Get targeted local opportunities',
    description:
      'Browse live nearby jobs and apply only to work that matches your availability, category, and expertise.',
  },
  {
    title: 'Grow without wasted ad spend',
    description:
      'No broad directory clutter, no expensive blanket advertising, and no chasing leads outside your operating area.',
  },
];

const platformPillars = [
  {
    icon: FiMapPin,
    title: 'Intelligent local matching',
    detail:
      'Our matching engine aligns location, category, timing, and job requirements to surface highly relevant professionals.',
  },
  {
    icon: FiZap,
    title: 'Real-time updates',
    detail:
      'Availability and booking status are continuously updated so customers and providers always see current information.',
  },
  {
    icon: FiSmartphone,
    title: 'Instant notifications',
    detail:
      'Push notifications keep both sides informed about new quotes, messages, approvals, and booking changes.',
  },
  {
    icon: FiMessageSquare,
    title: 'Streamlined communication',
    detail:
      'From enquiry to completion, every key interaction happens in one secure and structured workflow.',
  },
];

const trustHighlights = [
  'Verified professionals before job access',
  'Transparent, guideline-aligned pricing',
  'No hidden charges or inflated call-out surprises',
  'Clear quote comparison before commitment',
  'Fair compensation for professionals based on delivered value',
];

const serviceCategories = [
  { name: 'Electrical', image: '/images/ac.png' },
  { name: 'Plumbing', image: '/images/plumber.png' },
  { name: 'Painting & Decorating', image: '/images/image.png' },
  { name: 'Cleaning', image: '/images/bathroomClean.webp' },
  { name: 'Lawn & Garden', image: '/images/water.png' },
  { name: 'Handyman', image: '/images/door1.png' },
  { name: 'Pest Control', image: '/images/acClean.png' },
  { name: 'Removals & Commercial Support', image: '/images/bathroomBanner.png' },
];

const SectionHeading = ({ eyebrow, title, summary }) => (
  <div className="max-w-3xl">
    <p className="text-xs sm:text-sm font-bold tracking-[0.22em] uppercase text-blue-600">
      {eyebrow}
    </p>
    <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black leading-tight text-slate-950">
      {title}
    </h2>
    <p className="mt-4 text-base sm:text-lg leading-7 text-slate-600">{summary}</p>
  </div>
);

const AboutUs = () => {
  return (
    <div className="bg-slate-50 text-slate-900">
      <PublicNavbar variant="transparent" overlay />
      <section className="relative isolate min-h-[80vh] overflow-hidden">
        <img
          src="/images/SSaloon.jpg"
          alt="My Local Force professionals at work"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-r from-slate-950/40 via-slate-900/35 to-blue-900/20" />

        <div className="relative h-full min-h-[80vh] flex flex-col">
          <div className="flex-1 flex items-center px-4 pt-20 sm:px-6 md:px-8 lg:px-12">
            <div className="max-w-2xl py-10 sm:py-14 lg:py-20 text-white">
              <p className="text-gray-200 font-bold text-xs sm:text-sm mb-2 sm:mb-4 tracking-widest">
                About My Local Force
              </p>
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4 sm:mb-6">
                A smarter way to find <br /> trusted local professionals.
              </h1>
              <p className="text-gray-200 text-sm sm:text-base md:text-lg mb-6 sm:mb-10 max-w-xl">
                My Local Force is an on-demand service marketplace built to remove the stress from
                finding reliable, fairly priced local help. From quick repairs to full projects,
                customers and professionals connect faster with confidence, transparency, and
                control.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-8">
                <Link
                  to="/signup-selection"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
                >
                  Join My Local Force
                  <FiArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:support@mylocalforce.com.au"
                  className="inline-flex items-center gap-2 rounded-full border border-white/60 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                >
                  Contact Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-14 sm:px-6 md:px-8 lg:py-20">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 15%, #dbeafe 0, transparent 35%), radial-gradient(circle at 80% 85%, #bfdbfe 0, transparent 35%)',
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Why We Built It"
            title="Built from the ground up to fix a daily frustration"
            summary="Finding the right local professional should not take hours of searching, calling around, and uncertainty. We created My Local Force so customers can move from request to booking quickly, while trusted professionals can access real local demand without heavy upfront marketing costs."
          />

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border border-blue-100 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <FiUsers className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-black text-slate-950">For Customers</h3>
              <p className="mt-4 text-sm sm:text-base leading-7 text-slate-600">
                Customers stay in control at every step. Post a job in minutes, receive responses
                from qualified local providers, compare verified reviews and transparent quotes, and
                schedule work inside one secure platform. Every responding provider has completed
                platform verification before accessing customer jobs.
              </p>
            </article>

            <article className="rounded-3xl border border-emerald-100 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <FiShield className="h-5 w-5" />
              </div>
              <h3 className="text-2xl font-black text-slate-950">For Professionals</h3>
              <p className="mt-4 text-sm sm:text-base leading-7 text-slate-600">
                Tradespeople and specialists gain direct access to nearby customers actively looking
                to hire. Providers can focus on the jobs that fit their trade and schedule, without
                paying for broad advertising that does not convert. Local jobs, local demand, and
                real opportunities to grow.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 md:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Marketplace Flow"
            title="A clear process for both sides of the marketplace"
            summary="From first request to job completion, each step is designed to stay simple, fast, and accountable."
          />

          <div className="mt-10 grid gap-7 lg:grid-cols-2">
            <div className="rounded-3xl border-l-4 border-blue-600 bg-white p-7 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 w-12 bg-blue-600 rounded-full"></div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
                  Customer Journey
                </p>
              </div>
              <div className="space-y-5">
                {customerFlow.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border-l-4 border-blue-400 bg-blue-50 p-5"
                  >
                    <p className="text-xs font-bold tracking-[0.16em] text-blue-600">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border-l-4 border-emerald-600 bg-white p-7 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 w-12 bg-emerald-600 rounded-full"></div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-600">
                  Professional Journey
                </p>
              </div>
              <div className="space-y-5">
                {professionalFlow.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border-l-4 border-emerald-400 bg-emerald-50 p-5"
                  >
                    <p className="text-xs font-bold tracking-[0.16em] text-emerald-600">
                      Stage {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-100 px-4 py-14 sm:px-6 md:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Technology"
            title="Built for speed, relevance, and reliability"
            summary="Our platform technology keeps matching quality high and response times low, so both customers and providers spend less time waiting and more time moving jobs forward."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {platformPillars.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <article
                  key={pillar.title}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.07)]"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-xl font-black text-slate-950">{pillar.title}</h3>
                  <p className="mt-3 text-sm sm:text-base leading-7 text-slate-600">
                    {pillar.detail}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 md:px-8 lg:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Trust & Pricing"
              title="Transparent by design"
              summary="Our pricing model follows established platform and industry guidelines, helping customers understand costs upfront while ensuring professionals are fairly compensated for the work they deliver."
            />

            <div className="mt-8 space-y-3">
              {trustHighlights.map((highlight) => (
                <div
                  key={highlight}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <p className="text-sm sm:text-base text-slate-700">{highlight}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-[0_24px_50px_rgba(15,23,42,0.24)]">
            <img
              src="/images/womenServiceBanner.webp"
              alt="Transparent and fair local service marketplace"
              className="h-60 w-full object-cover"
            />
            <div className="space-y-5 p-6">
              <h3 className="text-2xl font-black">What this means in practice</h3>
              <div className="space-y-3 text-sm leading-7 text-slate-200">
                <p className="flex gap-3">
                  <FiDollarSign className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                  No hidden fees after booking confirmation.
                </p>
                <p className="flex gap-3">
                  <FiClock className="mt-1 h-4 w-4 shrink-0 text-blue-300" />
                  Faster hiring cycles with fewer dead-end enquiries.
                </p>
                <p className="flex gap-3">
                  <FiShield className="mt-1 h-4 w-4 shrink-0 text-blue-300" />A safer, verified
                  environment that builds accountability.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 md:px-8 lg:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Service Coverage"
            title="Domestic and commercial categories in one place"
            summary="My Local Force supports a broad and expanding service network including home maintenance, specialist trades, and business support work across growing regions."
          />

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {serviceCategories.map((category) => (
              <article
                key={category.name}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="h-40 overflow-hidden bg-slate-100">
                  <img
                    src={category.image}
                    alt={category.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                </div>
                <div className="p-4 border-t-4 border-blue-600">
                  <h3 className="text-lg font-bold text-slate-900">{category.name}</h3>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-4 py-14 sm:px-6 md:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-3xl border-l-4 border-blue-600 bg-white p-7 shadow-lg sm:p-10 lg:grid-cols-[1.4fr_0.6fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
              Support & Onboarding
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-950">
              Need help getting started?
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Our team supports both customers and professionals from day one. For platform support,
              onboarding help, or general enquiries, contact us directly and we will guide you
              through the next step.
            </p>
            <a
              href="mailto:support@mylocalforce.com.au"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              support@mylocalforce.com.au
              <FiArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="rounded-2xl border-t-4 border-emerald-600 bg-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">
              Core Promise
            </p>
            <p className="mt-3 text-lg font-bold leading-8 text-slate-900">
              Trusted professionals, transparent pricing, and local jobs matched faster for
              everyone.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutUs;
