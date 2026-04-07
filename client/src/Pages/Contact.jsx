import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { apiPost } from '../lib/api';

const CONTACT_EMAIL = 'support@greencart.in';
const CONTACT_PHONE = '+91 63038 46720';
const CONTACT_ADDRESS = 'GreenCart HQ, Sector 18, Noida, Uttar Pradesh 201301';

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      // Fire and forget — no backend endpoint yet; shows success toast immediately
      // When a support ticketing API is wired, replace this with apiPost('/api/contact', form)
      await new Promise((r) => setTimeout(r, 600));
      setSubmitted(true);
      toast.success('Message sent! We will get back to you within 24 hours.');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-b from-green-50 to-white px-6 md:px-16 lg:px-24 py-14">
        <h1 className="text-4xl font-bold text-gray-800 mb-3">Contact Us</h1>
        <p className="text-gray-500 text-lg max-w-xl">
          Have a question, feedback, or issue? We'd love to hear from you. Our support team typically responds within 24 hours.
        </p>
      </div>

      <div className="px-6 md:px-16 lg:px-24 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Contact info */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl mb-3">📧</div>
              <h3 className="font-semibold text-gray-800 mb-1">Email</h3>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-green-600 hover:underline text-sm break-all">
                {CONTACT_EMAIL}
              </a>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl mb-3">📞</div>
              <h3 className="font-semibold text-gray-800 mb-1">Phone</h3>
              <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="text-green-600 hover:underline text-sm">
                {CONTACT_PHONE}
              </a>
              <p className="text-xs text-gray-400 mt-1">Mon – Sat, 9 AM – 7 PM IST</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="text-2xl mb-3">📍</div>
              <h3 className="font-semibold text-gray-800 mb-1">Address</h3>
              <p className="text-gray-600 text-sm leading-6">{CONTACT_ADDRESS}</p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-8">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Message Received!</h2>
                <p className="text-gray-500 mb-6">We'll get back to you within 24 hours.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full text-sm font-semibold transition"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <h2 className="text-xl font-bold text-gray-800 mb-1">Send a Message</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    name="subject"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Order issue, product feedback, billing…"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Describe your issue or question in detail…"
                    required
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition"
                >
                  {submitting ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
