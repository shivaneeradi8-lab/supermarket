import React from "react";
import { apiGet } from "../../lib/api";

const STATUS_BADGE = {
	pending: "bg-yellow-100 text-yellow-700",
	processing: "bg-blue-100 text-blue-700",
	shipped: "bg-indigo-100 text-indigo-700",
	delivered: "bg-green-100 text-green-700",
	success: "bg-green-100 text-green-700",
	cancelled: "bg-red-100 text-red-700",
};

const Orders = () => {
	const [orders, setOrders] = React.useState([]);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState("");
	const [lastUpdated, setLastUpdated] = React.useState(null);

	const loadWeeklyOrders = React.useCallback(async () => {
		try {
			setError("");
			const result = await apiGet("/api/orders/weekly");
			if (!result?.success) {
				setError(result?.message || "Failed to load weekly orders");
				setOrders([]);
				return;
			}

			setOrders(Array.isArray(result.data) ? result.data : []);
			setLastUpdated(new Date());
		} catch (loadError) {
			setError("Failed to load weekly orders");
			setOrders([]);
		} finally {
			setLoading(false);
		}
	}, []);

	React.useEffect(() => {
		setLoading(true);
		loadWeeklyOrders();

		const intervalId = setInterval(() => {
			loadWeeklyOrders();
		}, 30000);

		return () => clearInterval(intervalId);
	}, [loadWeeklyOrders]);

	const summary = React.useMemo(() => {
		const totalOrders = orders.length;
		const delivered = orders.filter((order) => ["delivered", "success"].includes(String(order.status || "").toLowerCase())).length;
		const processing = orders.filter((order) => ["pending", "processing", "shipped"].includes(String(order.status || "").toLowerCase())).length;
		const revenue = orders.reduce((sum, order) => sum + Number(order.totalPrice || order.totalAmount || 0), 0);

		return {
			totalOrders,
			delivered,
			processing,
			revenue,
		};
	}, [orders]);

	return (
		<div className="space-y-6">
			<div className="bg-white border border-gray-200 rounded-lg p-6">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
					<div>
						<h2 className="text-2xl font-semibold text-gray-800">All Orders (Last 7 Days)</h2>
						<p className="text-sm text-gray-500">Auto-refreshes every 30 seconds for up-to-date order data.</p>
					</div>
					<button
						type="button"
						onClick={loadWeeklyOrders}
						className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
					>
						Refresh Now
					</button>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
					<div className="rounded border border-gray-200 p-3 bg-gray-50">
						<p className="text-xs uppercase text-gray-500">Total Orders</p>
						<p className="text-2xl font-bold text-gray-800">{summary.totalOrders}</p>
					</div>
					<div className="rounded border border-green-200 p-3 bg-green-50">
						<p className="text-xs uppercase text-green-700">Delivered</p>
						<p className="text-2xl font-bold text-green-800">{summary.delivered}</p>
					</div>
					<div className="rounded border border-blue-200 p-3 bg-blue-50">
						<p className="text-xs uppercase text-blue-700">In Progress</p>
						<p className="text-2xl font-bold text-blue-800">{summary.processing}</p>
					</div>
					<div className="rounded border border-amber-200 p-3 bg-amber-50">
						<p className="text-xs uppercase text-amber-700">Revenue</p>
						<p className="text-2xl font-bold text-amber-800">Rs {summary.revenue.toFixed(2)}</p>
					</div>
				</div>

				{lastUpdated && (
					<p className="text-xs text-gray-500 mt-4">Last updated: {lastUpdated.toLocaleString()}</p>
				)}
			</div>

			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<div className="grid grid-cols-[120px_2fr_1fr_1fr_130px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
					<p>Order</p>
					<p>Customer</p>
					<p>Date</p>
					<p>Total</p>
					<p>Status</p>
				</div>

				{loading ? (
					<div className="px-4 py-6 text-sm text-gray-500">Loading weekly orders...</div>
				) : error ? (
					<div className="px-4 py-6 text-sm text-red-600">{error}</div>
				) : orders.length === 0 ? (
					<div className="px-4 py-6 text-sm text-gray-500">No orders found in the last 7 days.</div>
				) : (
					orders.map((order) => {
						const normalizedStatus = String(order.status || "pending").toLowerCase();
						const badgeClass = STATUS_BADGE[normalizedStatus] || "bg-gray-100 text-gray-700";

						return (
							<div
								key={String(order._id || order.id)}
								className="grid grid-cols-[120px_2fr_1fr_1fr_130px] gap-3 px-4 py-3 border-b border-gray-100 items-center"
							>
								<p className="font-semibold text-gray-800">#{String(order._id || order.id).slice(-6).toUpperCase()}</p>
								<div>
									<p className="text-gray-800 font-medium">{order.user?.name || "Customer"}</p>
									<p className="text-xs text-gray-500">{order.user?.email || "No email"}</p>
								</div>
								<p className="text-gray-700 text-sm">{new Date(order.createdAt).toLocaleString()}</p>
								<p className="text-gray-800 font-semibold">Rs {Number(order.totalPrice || order.totalAmount || 0).toFixed(2)}</p>
								<span className={`inline-flex justify-center px-3 py-1 rounded text-xs font-medium ${badgeClass}`}>
									{normalizedStatus}
								</span>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};

export default Orders;
