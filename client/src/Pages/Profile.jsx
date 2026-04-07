import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { apiGet, apiPut } from '../lib/api';

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

const initForm = (data) => ({
  name: data?.name || '',
  phone: data?.phone || '',
  street: data?.address?.street || '',
  city: data?.address?.city || '',
  state: data?.address?.state || '',
  zipCode: data?.address?.zipCode || '',
  country: data?.address?.country || 'India',
});

const Profile = () => {
  const { user, setUser } = useAppContext();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(initForm({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      setLoading(true);
      const res = await apiGet('/api/users/profile');
      if (!mounted) return;
      if (res?.success) {
        setProfile(res.data);
        setForm(initForm(res.data));
      } else {
        toast.error(res?.message || 'Failed to load profile');
      }
      setLoading(false);
    };
    fetchProfile();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    const res = await apiPut('/api/users/profile', {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      address: {
        street: form.street.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        country: form.country.trim() || undefined,
      },
    });
    setSaving(false);
    if (res?.success) {
      setProfile(res.data);
      setUser((prev) => ({ ...prev, name: res.data.name }));
      setEditMode(false);
      toast.success('Profile updated!');
    } else {
      toast.error(res?.message || 'Failed to update profile');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-lg">Please log in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-b from-green-50 to-white px-6 md:px-16 lg:px-24 py-12">
        <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account details and saved addresses.</p>
      </div>

      <div className="px-6 md:px-16 lg:px-24 pb-20">
        <div className="max-w-2xl space-y-6">

          {/* Account summary card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700 shrink-0">
              {(profile?.name || user?.name || 'U')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xl font-bold text-gray-800">{profile?.name || user?.name}</p>
              <p className="text-gray-500 text-sm">{profile?.email || user?.email}</p>
              <span className="inline-block mt-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">
                {profile?.role || 'customer'}
              </span>
            </div>
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="ml-auto text-sm text-green-600 hover:text-green-700 font-semibold"
              >
                Edit
              </button>
            )}
          </div>

          {/* Edit form */}
          {editMode ? (
            <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-800 mb-2">Edit Details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input name="name" value={form.name} onChange={handleChange} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} type="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" />
                </div>
              </div>

              <hr className="border-gray-100" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Saved Address</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street / Area</label>
                <input name="street" value={form.street} onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input name="city" value={form.city} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select name="state" value={form.state} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-white">
                    <option value="">Select state</option>
                    {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code</label>
                  <input name="zipCode" value={form.zipCode} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input name="country" value={form.country} onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold px-6 py-2 rounded-lg transition text-sm">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => { setEditMode(false); setForm(initForm(profile)); }}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-6 py-2 rounded-lg transition text-sm">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
              <h2 className="text-lg font-bold text-gray-800">Account Details</h2>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <span className="text-gray-500">Phone</span>
                <span className="text-gray-800">{profile?.phone || <span className="text-gray-400 italic">Not set</span>}</span>
                <span className="text-gray-500">Street</span>
                <span className="text-gray-800">{profile?.address?.street || <span className="text-gray-400 italic">Not set</span>}</span>
                <span className="text-gray-500">City</span>
                <span className="text-gray-800">{profile?.address?.city || <span className="text-gray-400 italic">Not set</span>}</span>
                <span className="text-gray-500">State</span>
                <span className="text-gray-800">{profile?.address?.state || <span className="text-gray-400 italic">Not set</span>}</span>
                <span className="text-gray-500">PIN Code</span>
                <span className="text-gray-800">{profile?.address?.zipCode || <span className="text-gray-400 italic">Not set</span>}</span>
                <span className="text-gray-500">Country</span>
                <span className="text-gray-800">{profile?.address?.country || 'India'}</span>
                <span className="text-gray-500">Member since</span>
                <span className="text-gray-800">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
