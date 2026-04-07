import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { assets } from "../../assets/assets";
import { useAppContext } from "../../context/AppContext";

const Addproducts = () => {
	const navigate = useNavigate();
	const { addSellerProduct, sellerCategories, addSellerCategory, removeSellerCategory } = useAppContext();
	const [images, setImages] = useState([null, null, null, null]);
	const [customCategory, setCustomCategory] = useState("");
	const [customCategoryImage, setCustomCategoryImage] = useState(null);
	const [formData, setFormData] = useState({
		name: "",
		description: "",
		category: "Bakery",
		price: "",
		offerPrice: "",
		currentStock: "10",
		availableStock: "10",
		salePrice: "",
		isSaleActive: false,
	});

	const previewUrls = useMemo(
		() => images.map((file) => (file ? URL.createObjectURL(file) : null)),
		[images]
	);

	const handleImageChange = (index, file) => {
		if (!file) return;
		setImages((prev) => {
			const next = [...prev];
			next[index] = file;
			return next;
		});
	};

	const customCategoryPreview = useMemo(
		() => (customCategoryImage ? URL.createObjectURL(customCategoryImage) : null),
		[customCategoryImage]
	);

	const handleAddCategory = async () => {
		const categoryImageUrl = customCategoryImage ? await fileToDataUrl(customCategoryImage) : "";
		const result = addSellerCategory(customCategory, categoryImageUrl);

		if (!result.ok) {
			toast.error(result.message || "Unable to add category");
			return;
		}

		setFormData((prev) => ({ ...prev, category: result.category }));
		setCustomCategory("");
		setCustomCategoryImage(null);
		toast.success(result.created ? "Category added" : "Category already exists");
	};

	const handleCustomCategoryKeyDown = (event) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		void handleAddCategory();
	};

	const removableCategories = sellerCategories.filter(
		(category) => !["Bakery", "Vegetables", "Fruits", "Dairy", "Drinks", "Instant", "Grains"].includes(category)
	);

	const handleDeleteCategory = (category) => {
		const result = removeSellerCategory(category);

		if (!result.ok) {
			toast.error(result.message || "Unable to delete category");
			return;
		}

		if (formData.category.toLowerCase() === String(category).toLowerCase()) {
			setFormData((prev) => ({ ...prev, category: result.fallbackCategory || "Bakery" }));
		}

		toast.success("Category deleted");
	};

	const fileToDataUrl = (file) =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});

	const handleSubmit = async (event) => {
		event.preventDefault();

		const name = formData.name.trim();
		const description = formData.description.trim();
		const hasPrice = String(formData.price).trim() !== "";
		const hasOfferPrice = String(formData.offerPrice).trim() !== "";
		const hasImage = images.some(Boolean);
		const parsedCurrentStock = Math.max(0, Math.floor(Number(formData.currentStock || 0)));
		const parsedAvailableStock = Math.max(0, Math.floor(Number(formData.availableStock || 0)));
		const wantsCategoryCreate = Boolean(customCategory.trim());
		const isProductFormComplete = Boolean(name && description && hasPrice && hasOfferPrice && hasImage);

		if (wantsCategoryCreate && !isProductFormComplete) {
			await handleAddCategory();
			return;
		}

		if (!name || !description || !hasPrice || !hasOfferPrice) {
			toast.error("To add a product, please fill product name, description, price and offer price");
			return;
		}

		if (parsedAvailableStock > parsedCurrentStock) {
			toast.error("Available stock cannot be greater than current stock");
			return;
		}

		const uploadedImageUrls = await Promise.all(
			images.filter(Boolean).map((file) => fileToDataUrl(file))
		);

		if (uploadedImageUrls.length === 0) {
			toast.error("Please upload at least one product image");
			return;
		}

		let categoryToUse = formData.category;
		if (wantsCategoryCreate) {
			const categoryImageUrl = customCategoryImage ? await fileToDataUrl(customCategoryImage) : "";
			const categoryResult = addSellerCategory(customCategory, categoryImageUrl);
			if (!categoryResult.ok) {
				toast.error(categoryResult.message || "Unable to add category");
				return;
			}

			categoryToUse = categoryResult.category;
			setFormData((prev) => ({ ...prev, category: categoryToUse }));
			setCustomCategory("");
			setCustomCategoryImage(null);
		}

		const createResult = await addSellerProduct({
			name,
			description,
			category: categoryToUse,
			price: Number(formData.price),
			offerPrice: Number(formData.offerPrice),
			currentStock: parsedCurrentStock,
			availableStock: parsedAvailableStock,
			salePrice: Number(formData.salePrice || 0),
			isSaleActive: Boolean(formData.isSaleActive),
			images: uploadedImageUrls,
		});

		if (!createResult?.success) {
			toast.error(createResult?.message || "Failed to add product");
			return;
		}

		toast.success(createResult?.message || "Product added successfully");
		navigate("/seller/product-list");
	};

	return (
		<form onSubmit={handleSubmit} className="max-w-3xl">
			<p className="text-3xl font-semibold text-gray-800 mb-6">Product Image</p>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
				{Array.from({ length: 4 }).map((_, index) => (
					<label key={index} className="border border-dashed border-gray-300 w-24 h-16 sm:w-28 sm:h-20 flex items-center justify-center cursor-pointer bg-white">
						<input
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => handleImageChange(index, e.target.files?.[0])}
						/>
						{previewUrls[index] ? (
							<img src={previewUrls[index]} alt={`product-${index + 1}`} className="w-full h-full object-cover" />
						) : (
							<img src={assets.upload_area} alt="Upload" className="w-full h-full object-contain" />
						)}
					</label>
				))}
			</div>

			<div className="mb-5">
				<p className="text-xl font-medium mb-2">Product Name</p>
				<input
					type="text"
					value={formData.name}
					onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
					placeholder="Type here"
					className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
				/>
			</div>

			<div className="mb-5">
				<p className="text-xl font-medium mb-2">Product Description</p>
				<textarea
					value={formData.description}
					onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
					placeholder="Type here"
					rows={5}
					className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
				/>
			</div>

			<div className="mb-5">
				<p className="text-xl font-medium mb-2">Category</p>
				<select
					value={formData.category}
					onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
					className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
				>
					{sellerCategories.map((category) => (
						<option key={category} value={category}>{category}</option>
					))}
				</select>

				<div className="mt-3 flex flex-col sm:flex-row gap-2">
					<input
						type="text"
						value={customCategory}
						onChange={(e) => setCustomCategory(e.target.value)}
						onKeyDown={handleCustomCategoryKeyDown}
						placeholder="Create new category"
						className="w-full border border-gray-300 rounded-md px-4 py-2.5 outline-none focus:border-primary bg-white"
					/>
					<button
						type="button"
						onClick={() => void handleAddCategory()}
						className="px-5 py-2.5 rounded-md border border-primary text-primary hover:bg-primary/10 font-medium"
					>
						Add Category
					</button>
				</div>

				<div className="mt-2 flex items-center gap-3">
					<label className="border border-dashed border-gray-300 w-20 h-20 rounded-md flex items-center justify-center cursor-pointer bg-white overflow-hidden">
						<input
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(e) => setCustomCategoryImage(e.target.files?.[0] || null)}
						/>
						{customCategoryPreview ? (
							<img src={customCategoryPreview} alt="category-preview" className="w-full h-full object-cover" />
						) : (
							<img src={assets.upload_area} alt="Upload category" className="w-full h-full object-contain p-2" />
						)}
					</label>
					<p className="text-sm text-gray-500">Optional category image for category lists</p>
				</div>

				{removableCategories.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{removableCategories.map((category) => (
							<span key={category} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm">
								{category}
								<button
									type="button"
									onClick={() => handleDeleteCategory(category)}
									className="text-red-600 font-semibold leading-none"
									aria-label={`delete-${category}`}
								>
									x
								</button>
							</span>
						))}
					</div>
				) : null}
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
				<div>
					<p className="text-xl font-medium mb-2">Product Price</p>
					<input
						type="number"
						min="0"
						value={formData.price}
						onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
						placeholder="0"
						className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
					/>
				</div>

				<div>
					<p className="text-xl font-medium mb-2">Offer Price</p>
					<input
						type="number"
						min="0"
						value={formData.offerPrice}
						onChange={(e) => setFormData((prev) => ({ ...prev, offerPrice: e.target.value }))}
						placeholder="0"
						className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
					/>
				</div>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
				<div>
					<p className="text-xl font-medium mb-2">Current Stock (Physical)</p>
					<input
						type="number"
						min="0"
						value={formData.currentStock}
						onChange={(e) => setFormData((prev) => ({ ...prev, currentStock: e.target.value }))}
						placeholder="0"
						className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
					/>
				</div>

				<div>
					<p className="text-xl font-medium mb-2">Available Stock</p>
					<input
						type="number"
						min="0"
						value={formData.availableStock}
						onChange={(e) => setFormData((prev) => ({ ...prev, availableStock: e.target.value }))}
						placeholder="0"
						className="w-full border border-gray-300 rounded-md px-4 py-3 outline-none focus:border-primary bg-white"
					/>
				</div>
			</div>

			<div className="mb-6 border border-gray-200 rounded-md p-4 bg-white">
				<div className="flex items-center justify-between gap-4">
					<div>
						<p className="text-lg font-medium text-gray-800">Enable Sale Price</p>
						<p className="text-sm text-gray-500">Toggle promo pricing for near-expiry or campaign items.</p>
					</div>
					<label className="inline-flex items-center gap-2">
						<input
							type="checkbox"
							checked={formData.isSaleActive}
							onChange={(e) => setFormData((prev) => ({ ...prev, isSaleActive: e.target.checked }))}
							className="h-5 w-5"
						/>
						<span className="text-sm font-medium text-gray-700">Active</span>
					</label>
				</div>

				<div className="mt-4 max-w-xs">
					<p className="text-sm font-medium mb-1">Sale Price</p>
					<input
						type="number"
						min="0"
						value={formData.salePrice}
						onChange={(e) => setFormData((prev) => ({ ...prev, salePrice: e.target.value }))}
						placeholder="0"
						className="w-full border border-gray-300 rounded-md px-4 py-2.5 outline-none focus:border-primary bg-white"
					/>
				</div>
			</div>

			<button
				type="submit"
				className="bg-indigo-500 hover:bg-indigo-600 text-white text-2xl px-10 py-2 rounded-md"
			>
				ADD
			</button>
		</form>
	);
};

export default Addproducts;
