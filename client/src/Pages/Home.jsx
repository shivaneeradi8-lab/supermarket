import React from 'react';
import MainBanner from '../Components/MainBanner';
import Categories from '../Components/categories';
import BestSeller from '../Components/BestSeller';
import { assets, footerLinks } from '../assets/assets';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiPost } from '../lib/api';

const Home = () => {
  const footerSections = footerLinks.filter((section) => section.title !== 'Follow Us');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) { toast.error('Please enter your email address.'); return; }
    setSubscribing(true);
    const res = await apiPost('/api/newsletter', { email });
    setSubscribing(false);
    if (res?.success) {
      toast.success(res.message || 'Subscribed!');
      setNewsletterEmail('');
    } else {
      toast.error(res?.message || 'Subscription failed. Please try again.');
    }
  };

  return (
    <div className='mt-10'>
      <MainBanner />
      <Categories />
      <BestSeller />  

      {/* Features Section */}
      <section className="px-6 md:px-16 lg:px-24 py-16 bg-white">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🚚</div>
            <h3 className="text-xl font-bold mb-2">Fast Delivery</h3>
            <p className="text-gray-600">Get your groceries in 20 minutes or less</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold mb-2">Fresh Produce</h3>
            <p className="text-gray-600">Handpicked fresh items every day</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-2">Best Prices</h3>
            <p className="text-gray-600">Competitive prices with regular discounts</p>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-16 lg:px-24 py-16 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-800">Never Miss a Deal!</h2>
          <p className="mt-4 text-xl text-gray-500">
            Subscribe to get the latest offers, new arrivals, and exclusive discounts
          </p>

          <form onSubmit={handleSubscribe} className="mt-10 flex flex-col sm:flex-row border border-gray-300 rounded-lg overflow-hidden">
            <input
              type="email"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              placeholder="Enter your email id"
              className="w-full px-5 py-4 outline-none"
              required
            />
            <button
              type="submit"
              disabled={subscribing}
              className="bg-primary hover:bg-primary-dull disabled:opacity-60 text-white px-8 py-4 font-semibold sm:min-w-44"
            >
              {subscribing ? 'Subscribing…' : 'Subscribe'}
            </button>
          </form>
        </div>
      </section>

      <footer className="bg-[#eaf3ef] px-6 md:px-16 lg:px-24 pt-12 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-10 gap-y-8">
          <div>
            <img src={assets.logo} alt="GreenCart" className="w-40" />
            <p className="mt-6 text-gray-600 leading-8 max-w-md">
              We deliver fresh groceries and snacks straight to your door. Trusted by thousands,
              we aim to make your shopping experience simple and affordable.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">{section.title}</h3>
              <ul className="space-y-2 text-gray-600 text-base">
                {section.links.map((link) => (
                  <li key={link.text} className="hover:text-gray-900 cursor-pointer transition">
                    {link.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-gray-300 pt-6 text-center text-gray-700">
          Copyright 2025 © GreatStack.dev All Right Reserved.
        </div>
      </footer>
    </div>
  );
};

export default Home;
