import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { assets } from "../../assets/assets";
import { useAppContext } from "../../context/AppContext";
import { apiPost, saveToken } from "../../lib/api";

const LOCAL_SELLER_EMAIL = "shivaneeradi575@gmail.com";
const LOCAL_SELLER_PASSWORD = "shiva@1212";

const createLocalSellerUser = () => ({
	name: "Shivani Seller",
	email: LOCAL_SELLER_EMAIL,
	role: "seller",
	phone: "",
});

const SellerLogin = () => {
	const navigate = useNavigate();
	const { setIsSeller, setUser } = useAppContext();
	const [credentials, setCredentials] = useState({ email: "", password: "" });
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (event) => {
		event.preventDefault();
		if (!credentials.email || !credentials.password) return;

		const normalizedEmail = String(credentials.email).trim().toLowerCase();

		setLoading(true);
		const result = await apiPost("/api/auth/login", {
			email: normalizedEmail,
			password: credentials.password,
		});
		setLoading(false);

		if (!result?.success || !result?.data?.token || !result?.data?.user) {
			if (normalizedEmail === LOCAL_SELLER_EMAIL && credentials.password === LOCAL_SELLER_PASSWORD) {
				const nextUser = createLocalSellerUser();
				localStorage.setItem("greencart_user", JSON.stringify(nextUser));
				setUser(nextUser);
				setIsSeller(true);
				toast.success("Seller login successful");
				navigate("/seller/dashboard");
				return;
			}

			toast.error(result?.message || "Login failed");
			return;
		}

		const nextUser = result.data.user;
		if (!["seller", "admin"].includes(String(nextUser.role || ""))) {
			toast.error("Access denied. Seller or admin role required.");
			return;
		}

		saveToken(result.data.token);
		localStorage.setItem("greencart_user", JSON.stringify(nextUser));
		setUser(nextUser);
		setIsSeller(true);
		toast.success("Seller login successful");
		navigate("/seller/dashboard");
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
			<form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-200">
				<img src={assets.logo} alt="GreenCart" className="w-40 mb-6" />
				<h1 className="text-2xl font-semibold text-gray-800 mb-2">Seller Login</h1>
				<p className="text-gray-500 mb-6">Login to manage products and orders.</p>

				<div className="space-y-4">
					<input
						type="email"
						value={credentials.email}
						onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))}
						placeholder="Seller Email"
						className="w-full border border-gray-300 rounded-md px-4 py-2.5 outline-none focus:border-primary"
					/>
					<input
						type="password"
						value={credentials.password}
						onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))}
						placeholder="Password"
						className="w-full border border-gray-300 rounded-md px-4 py-2.5 outline-none focus:border-primary"
					/>
				</div>

				<button type="submit" disabled={loading} className="w-full mt-6 bg-primary hover:bg-primary-dull text-white py-2.5 rounded-md font-medium transition disabled:opacity-60">
					{loading ? "Signing in..." : "Login"}
				</button>
			</form>
		</div>
	);
};

const SellerLayout = () => {
	const navigate = useNavigate();
	const { isSeller, setIsSeller } = useAppContext();

	if (!isSeller) {
		return <SellerLogin />;
	}

	return (
		<div className="min-h-screen bg-[#f7f7f7]">
			<header className="h-16 px-6 md:px-10 bg-white border-b border-gray-300 flex items-center justify-between">
				<img src={assets.logo} alt="GreenCart" className="w-40" />
				<div className="flex items-center gap-3 text-gray-700">
					<p>Hi! Admin</p>
					<button
						type="button"
						onClick={() => navigate('/')}
						className="px-4 py-1.5 rounded-full border border-gray-300 hover:bg-gray-100 transition"
					>
						Back to Store
					</button>
					<button
						type="button"
						onClick={() => {
							setIsSeller(false);
							navigate("/");
						}}
						className="px-6 py-1.5 rounded-full border border-gray-400 hover:bg-gray-100 transition"
					>
						Logout
					</button>
				</div>
			</header>

			<div className="grid grid-cols-1 md:grid-cols-[270px_1fr]">
				<aside className="bg-white border-r border-gray-300 md:min-h-[calc(100vh-64px)]">
					<nav className="pt-4">
						<NavLink
							to="/seller/dashboard"
							className={({ isActive }) => `flex items-center gap-4 px-6 py-4 border-l-4 transition ${isActive ? "border-primary bg-[#eaf4ef] text-primary" : "border-transparent text-gray-700 hover:bg-gray-50"}`}
						>
							<img src={assets.order_icon} alt="Dashboard" className="w-6 h-6" />
							<span className="text-lg font-medium">Dashboard</span>
						</NavLink>

						<NavLink
							to="/seller/add-product"
							className={({ isActive }) => `flex items-center gap-4 px-6 py-4 border-l-4 transition ${isActive ? "border-primary bg-[#eaf4ef] text-primary" : "border-transparent text-gray-700 hover:bg-gray-50"}`}
						>
							<img src={assets.add_icon} alt="Add product" className="w-6 h-6" />
							<span className="text-lg font-medium">Add Product</span>
						</NavLink>

						<NavLink
							to="/seller/product-list"
							className={({ isActive }) => `flex items-center gap-4 px-6 py-4 border-l-4 transition ${isActive ? "border-primary bg-[#eaf4ef] text-primary" : "border-transparent text-gray-700 hover:bg-gray-50"}`}
						>
							<img src={assets.product_list_icon} alt="Product list" className="w-6 h-6" />
							<span className="text-lg">Product List</span>
						</NavLink>

						<NavLink
							to="/seller/orders"
							className={({ isActive }) => `flex items-center gap-4 px-6 py-4 border-l-4 transition ${isActive ? "border-primary bg-[#eaf4ef] text-primary" : "border-transparent text-gray-700 hover:bg-gray-50"}`}
						>
							<img src={assets.order_icon} alt="Orders" className="w-6 h-6" />
							<span className="text-lg">Orders</span>
						</NavLink>
					</nav>
				</aside>

				<main className="p-6 md:p-10">
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default SellerLayout;
