'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Order = {
  _id: string;
  status: string;
  totalPrice: number;
  createdAt: string;
  paymentMethod?: string;
  user?: { name?: string; email?: string };
};
type Product = { _id: string; name: string; stock: number; category: string; isActive: boolean; price: number };

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  success: 'bg-green-100 text-green-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

async function apiFetch(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('greencart_token') : '';
  try {
    const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return res.json();
  } catch {
    return {};
  }
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/orders?limit=50'),
      apiFetch('/api/products?limit=50'),
    ]).then(([o, p]) => {
      setOrders(Array.isArray(o?.data) ? o.data : []);
      setProducts(Array.isArray(p?.data) ? p.data : []);
      setLoading(false);
    });
  }, []);

  const totalRevenue = useMemo(
    () =>
      orders
        .filter((o) => ['success', 'delivered'].includes(o.status))
        .reduce((s, o) => s + Number(o.totalPrice || 0), 0),
    [orders]
  );
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const lowStock = products.filter((p) => Number(p.stock) <= 5 && p.isActive);
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <Link href="/" className="text-2xl font-bold text-green-600">GreenCart Admin</Link>
          <nav className="hidden md:flex space-x-6 text-sm">
            <Link href="/admin" className="text-green-600 font-semibold">Dashboard</Link>
            <Link href="/admin/payments" className="text-gray-600 hover:text-green-600">Payment Monitor</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Orders', value: String(orders.length), icon: '🛒', color: 'bg-blue-50' },
                { label: 'Revenue', value: fmt(totalRevenue), icon: '💰', color: 'bg-green-50' },
                { label: 'Pending', value: String(pendingCount), icon: '⏳', color: 'bg-yellow-50' },
                { label: 'Low Stock', value: String(lowStock.length), icon: '⚠️', color: 'bg-red-50' },
              ].map((card) => (
                <div key={card.label} className={`${card.color} rounded-xl border border-gray-200 p-5`}>
                  <div className="text-2xl mb-1">{card.icon}</div>
                  <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-0.5">{card.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Orders */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">Recent Orders</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase">
                        <th className="px-5 py-3 text-left">Order ID</th>
                        <th className="px-5 py-3 text-left">Date</th>
                        <th className="px-5 py-3 text-left">Amount</th>
                        <th className="px-5 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-5 py-3 font-mono text-xs text-gray-600">
                            #{String(order._id).slice(-6)}
                          </td>
                          <td className="px-5 py-3 text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-800">{fmt(Number(order.totalPrice))}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                                STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                            No orders yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Low stock products */}
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800">Low Stock Alert</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase">
                        <th className="px-5 py-3 text-left">Product</th>
                        <th className="px-5 py-3 text-left">Category</th>
                        <th className="px-5 py-3 text-left">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStock.map((p) => (
                        <tr key={p._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-5 py-3 font-medium text-gray-800 truncate max-w-[180px]">{p.name}</td>
                          <td className="px-5 py-3 text-gray-500">{p.category}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                Number(p.stock) === 0
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {p.stock} left
                            </span>
                          </td>
                        </tr>
                      ))}
                      {lowStock.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                            All products well-stocked ✓
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Link
                  href="/admin/payments"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  <span className="text-2xl">🚨</span>
                  <span className="font-medium text-gray-800">Payment Monitor</span>
                </Link>
                <Link
                  href="/"
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  <span className="text-2xl">🛒</span>
                  <span className="font-medium text-gray-800">View Storefront</span>
                </Link>
                <div className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl text-gray-400 cursor-not-allowed">
                  <span className="text-2xl">📊</span>
                  <span className="font-medium">Reports (soon)</span>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
