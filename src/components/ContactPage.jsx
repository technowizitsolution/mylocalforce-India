import { useState } from 'react';
import { Phone, Send } from 'lucide-react';
import Footer from './Footer';
import PublicNavbar from './PublicNavbar';

const CONTACT_FORM_URL = 'https://us-central1-mylocalforce-295b8.cloudfunctions.net/submitContactForm';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

const ContactPage = () => {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (!name || !email || !message) {
      setStatus({
        type: 'error',
        text: 'Please enter your name, email, and message.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(CONTACT_FORM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone: form.phone.trim(),
          subject: form.subject.trim() || 'Website contact request',
          message,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error || result?.message || 'Unable to send your message. Please try again.',
        );
      }

      setForm(initialForm);
      setStatus({
        type: 'success',
        text: 'Thank you. We received your message and will get back to you soon.',
      });
    } catch (error) {
      console.error('Contact form submission failed:', error);
      setStatus({
        type: 'error',
        text: error?.message || 'Unable to send your message. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <section className="flex flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Contact us</p>
          <h1 className="mt-3 text-3xl font-bold text-gray-950 sm:text-4xl">
            Send us a message.
          </h1>
          <p className="mt-4 text-base leading-7 text-gray-600">
            Use this form for general questions, feedback, or help. Your message goes directly to
            our team by email and does not create a support case.
          </p>

          <div className="mt-8 space-y-4">
            {/* <a
              href="mailto:support@mylocalforce.com.au"
              className="flex items-center gap-3 text-sm font-semibold text-gray-700 transition hover:text-blue-700"
            >
              <Mail className="h-5 w-5 text-blue-600" />
              support@mylocalforce.com.au
            </a> */}
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
              <Phone className="h-5 w-5 text-blue-600" />
              We will get back to you soon
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-gray-50 p-5 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contact-phone"
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Phone
                </label>
                <input
                  id="contact-phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-subject"
                  className="mb-2 block text-sm font-semibold text-gray-900"
                >
                  Subject
                </label>
                <input
                  id="contact-subject"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  className="h-12 w-full rounded-md border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  placeholder="How can we help?"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="contact-message"
                className="mb-2 block text-sm font-semibold text-gray-900"
              >
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                value={form.message}
                onChange={handleChange}
                rows={7}
                className="w-full resize-none rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Write your message"
              />
            </div>

            {status ? (
              <div
                className={`rounded-md border px-4 py-3 text-sm font-medium ${
                  status.type === 'success'
                    ? 'border-green-200 bg-green-50 text-green-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {status.text}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ContactPage;
