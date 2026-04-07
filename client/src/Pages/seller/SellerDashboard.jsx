import React, { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../lib/api";

const statusColor = {
  Delivered: "bg-green-100 text-green-700",
  Processing: "bg-yellow-100 text-yellow-700",
  Shipped: "bg-blue-100 text-blue-700",
  pending: "bg-yellow-100 text-yellow-700",
  success: "bg-green-100 text-green-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const productStatusColor = {
  Active: "bg-green-100 text-green-700",
  "Out of Stock": "bg-red-100 text-red-700",
};

const SellerDashboard = () => {
  const { fetchDailyXReport } = useAppContext();
  const navigate = useNavigate();

  // Live stats state
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [xReport, setXReport] = useState(null);
  const [xReportLoading, setXReportLoading] = useState(false);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        const data = await apiGet("/api/orders");
        setOrders(data?.orders || data?.data || []);
      } catch (e) {
        setOrders([]);
      }
      setLoading(false);
    }
    fetchOrders();
  }, []);

  const loadXReport = async (dateValue) => {
    setXReportLoading(true);
    const result = await fetchDailyXReport(dateValue);
    if (result?.success) {
      setXReport(result.data);
    } else {
      setXReport(null);
    }
    setXReportLoading(false);
  };

  useEffect(() => {
    loadXReport(reportDate);
  }, [reportDate]);

  useEffect(() => {
    async function fetchProducts() {
      setLoadingProducts(true);
      try {
        const data = await apiGet("/api/products");
        setProducts(data?.products || data?.data || []);
      } catch (e) {
        setProducts([]);
      }
      setLoadingProducts(false);
    }
    fetchProducts();
  }, []);

  const totalOrders = orders.length;
  const revenue = orders.reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0);
  const customers = new Set(orders.map(order => order.customerId || order.user)).size;
  const totalProducts = products.length;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <div className="text-4xl mb-2">📦</div>
          <div className="text-lg text-gray-500">Total Products</div>
          <div className="text-3xl font-bold">{loadingProducts ? "Loading..." : totalProducts}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <div className="text-4xl mb-2">🛒</div>
          <div className="text-lg text-gray-500">Total Orders</div>
          <div className="text-3xl font-bold">{loading ? "Loading..." : totalOrders}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <div className="text-4xl mb-2">💰</div>
          <div className="text-lg text-gray-500">Revenue</div>
          <div className="text-3xl font-bold">Rs {loading ? "Loading..." : revenue}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <div className="text-4xl mb-2">👥</div>
          <div className="text-lg text-gray-500">Customers</div>
          <div className="text-3xl font-bold">{loading ? "Loading..." : customers}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-2xl font-semibold">Daily X-Report</h2>
              <p className="text-sm text-gray-500">Sold vs added stock for the selected date</p>
            </div>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2"
            />
          </div>

          {xReportLoading ? (
            <p className="text-gray-500">Loading report...</p>
          ) : xReport ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded border border-green-200 bg-green-50 p-3">
                  <p className="text-xs text-green-700 uppercase">Added</p>
                  <p className="text-2xl font-bold text-green-800">{xReport.totals?.added ?? 0}</p>
                </div>
                <div className="rounded border border-red-200 bg-red-50 p-3">
                  <p className="text-xs text-red-700 uppercase">Sold</p>
                  <p className="text-2xl font-bold text-red-800">{xReport.totals?.sold ?? 0}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-600 uppercase">Net</p>
                  <p className="text-2xl font-bold text-gray-800">{xReport.totals?.net ?? 0}</p>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-md">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-600 uppercase min-w-[560px]">
                  <p>Product</p>
                  <p>Added</p>
                  <p>Sold</p>
                  <p>Net</p>
                </div>
                {(xReport.products || []).slice(0, 8).map((row) => (
                  <div key={row.productId} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 border-t border-gray-100 min-w-[560px]">
                    <p className="font-medium text-gray-800 truncate">{row.productName}</p>
                    <p className="text-green-700">{row.added}</p>
                    <p className="text-red-700">{row.sold}</p>
                    <p className="text-gray-800">{row.net}</p>
                  </div>
                ))}
                {(!xReport.products || xReport.products.length === 0) && (
                  <p className="px-4 py-5 text-sm text-gray-500">No add/sale stock logs for this date.</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Unable to load X-report. Ensure seller/admin auth token is active.</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-4">Recent Orders</h2>
          <div className="space-y-4">
            {orders.slice(0, 5).map((order) => (
              <div key={order._id || order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-semibold">#{String(order._id || order.id).slice(-6).toUpperCase()}</div>
                  <div className="text-gray-500 text-sm">{order.user?.name || "Customer"}</div>
                  <div className="text-gray-400 text-xs">{new Date(order.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-semibold">Rs {Number(order.totalPrice || order.totalAmount || 0).toFixed(2)}</div>
                  <span className={`px-3 py-1 rounded ${statusColor[order.status] || "bg-gray-100 text-gray-700"}`}>{String(order.status || "pending")}</span>
                </div>
              </div>
            ))}
            {!loading && orders.length === 0 && (
              <p className="text-sm text-gray-500">No recent orders found.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate("/seller/orders")}
            className="mt-6 text-green-600 font-semibold cursor-pointer"
          >
            View All Orders →
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellerDashboard;
