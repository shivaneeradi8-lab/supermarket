import React from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";

const Productlist = () => {
	const { sellerProducts, toggleSellerProductStock, removeSellerProduct, updateSellerProductDetails } = useAppContext();
	const [draftById, setDraftById] = React.useState({});
	const [saving, setSaving] = React.useState(false);

	const buildDraft = (item) => ({
		currentStock: Number(item.currentStock ?? item.stockQty ?? item.stock ?? 10),
		availableStock: Number(item.availableStock ?? item.stockQty ?? item.stock ?? 10),
		salePrice: Number(item.salePrice ?? item.offerPrice ?? 0),
		isSaleActive: Boolean(item.isSaleActive),
	});

	React.useEffect(() => {
		const initialDraft = sellerProducts.reduce((acc, item) => {
			const id = String(item._id ?? item.id);
			acc[id] = buildDraft(item);
			return acc;
		}, {});
		setDraftById(initialDraft);
	}, [sellerProducts]);

	const hasChanges = React.useMemo(() => sellerProducts.some((item) => {
		const id = String(item._id ?? item.id);
		const draft = draftById[id];
		if (!draft) return false;

		const currentDraft = buildDraft(item);
		return (
			Number(draft.currentStock) !== Number(currentDraft.currentStock)
			|| Number(draft.availableStock) !== Number(currentDraft.availableStock)
			|| Number(draft.salePrice) !== Number(currentDraft.salePrice)
			|| Boolean(draft.isSaleActive) !== Boolean(currentDraft.isSaleActive)
		);
	}), [sellerProducts, draftById]);

	const updateDraftField = (productId, field, value) => {
		setDraftById((prev) => {
			const next = { ...(prev[productId] || {}) };
			if (field === "isSaleActive") {
				next.isSaleActive = Boolean(value);
			} else {
				const parsed = Number(value);
				next[field] = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
			}

			return {
				...prev,
				[productId]: next,
			};
		});
	};

	const handleSaveInventoryChanges = async () => {
		if (saving) return;

		const changedProducts = sellerProducts
			.map((item) => {
				const productId = String(item._id ?? item.id);
				const draft = draftById[productId];
				if (!draft) return null;

				const currentValues = buildDraft(item);
				const hasItemChange =
					Number(draft.currentStock) !== Number(currentValues.currentStock)
					|| Number(draft.availableStock) !== Number(currentValues.availableStock)
					|| Number(draft.salePrice) !== Number(currentValues.salePrice)
					|| Boolean(draft.isSaleActive) !== Boolean(currentValues.isSaleActive);

				if (!hasItemChange) return null;

				return {
					id: productId,
					name: item.name,
					payload: {
						currentStock: Number(draft.currentStock),
						availableStock: Number(draft.availableStock),
						salePrice: Number(draft.salePrice),
						isSaleActive: Boolean(draft.isSaleActive),
					},
				};
			})
			.filter(Boolean);

		if (changedProducts.length === 0) {
			toast("No inventory or sale changes to save");
			return;
		}

		const hasInvalidStock = changedProducts.some(
			(product) => Number(product.payload.availableStock) > Number(product.payload.currentStock)
		);

		if (hasInvalidStock) {
			toast.error("Available stock cannot exceed current stock");
			return;
		}

		setSaving(true);
		const results = await Promise.all(
			changedProducts.map((product) =>
				updateSellerProductDetails(product.id, product.payload)
			)
		);
		setSaving(false);

		const failed = results.filter((result) => !result?.success);
		if (failed.length > 0) {
			toast.error(`Saved ${results.length - failed.length} of ${results.length}. Please retry failed updates.`);
			return;
		}

		toast.success("Inventory and pricing updated successfully");
	};

	return (
		<div className="space-y-6">
			<div className="bg-white border border-gray-200 rounded-lg p-5">
				<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
					<div>
						<h2 className="text-xl font-semibold text-gray-800">Inventory and Sale Controls</h2>
						<p className="text-sm text-gray-600 mt-1">Set physical stock, reservable stock, and promo sale price in one save.</p>
					</div>
					<button
						type="button"
						onClick={handleSaveInventoryChanges}
						disabled={!hasChanges || saving}
						className="px-5 py-2.5 rounded-md bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? "Saving..." : "Save Changes"}
					</button>
				</div>

				<div className="overflow-x-auto mt-5 border border-gray-200 rounded-lg">
					<div className="grid grid-cols-[2fr_130px_130px_120px_110px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700 min-w-[840px]">
						<p>Product</p>
						<p>Current Stock</p>
						<p>Available Stock</p>
						<p>Sale Active</p>
						<p>Sale Price</p>
					</div>
					{sellerProducts.map((item) => {
						const productId = String(item._id ?? item.id);
						const currentValues = buildDraft(item);
						const draft = draftById[productId] || currentValues;

						return (
							<div key={`stock-${productId}`} className="grid grid-cols-[2fr_130px_130px_120px_110px] gap-3 px-4 py-3 border-b border-gray-100 items-center min-w-[840px]">
								<p className="font-medium text-gray-800 truncate">{item.name}</p>
								<input
									type="number"
									min={0}
									value={Number(draft.currentStock)}
									onChange={(e) => updateDraftField(productId, "currentStock", e.target.value)}
									className="w-full border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-primary"
								/>
								<input
									type="number"
									min={0}
									value={Number(draft.availableStock)}
									onChange={(e) => updateDraftField(productId, "availableStock", e.target.value)}
									className="w-full border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-primary"
								/>
								<label className="inline-flex items-center gap-2">
									<input
										type="checkbox"
										checked={Boolean(draft.isSaleActive)}
										onChange={(e) => updateDraftField(productId, "isSaleActive", e.target.checked)}
										className="h-4 w-4"
									/>
									<span className="text-sm text-gray-700">On</span>
								</label>
								<input
									type="number"
									min={0}
									value={Number(draft.salePrice)}
									onChange={(e) => updateDraftField(productId, "salePrice", e.target.value)}
									className="w-full border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-primary"
								/>
							</div>
						);
					})}
				</div>
			</div>

			<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
				<div className="grid grid-cols-[90px_2fr_1fr_1fr_120px_220px] gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700">
					<p>Image</p>
					<p>Name</p>
					<p>Category</p>
					<p>Offer Price</p>
					<p>In Stock</p>
					<p>Actions</p>
				</div>

				{sellerProducts.map((item) => {
					const imageSrc = Array.isArray(item.image) ? item.image[0] : item.image;

					return (
						<div key={item._id ?? item.id} className="grid grid-cols-[90px_2fr_1fr_1fr_120px_220px] gap-3 px-4 py-3 border-b border-gray-100 items-center">
							<img src={imageSrc} alt={item.name} className="w-14 h-14 object-cover rounded border border-gray-200" />
							<p className="font-medium text-gray-800">{item.name}</p>
							<p className="text-gray-600">{item.category}</p>
							<p className="text-gray-800">Rs {item.offerPrice ?? item.price}</p>
							<button
								type="button"
								onClick={() => {
									toggleSellerProductStock(item._id ?? item.id);
									toast.success(item.inStock ? "Product hidden from All Products" : "Product visible in All Products");
								}}
								className={`w-16 h-8 rounded-full p-1 transition ${item.inStock ? "bg-green-500" : "bg-gray-300"}`}
								aria-label={`toggle-${item.name}`}
							>
								<span
									className={`block w-6 h-6 rounded-full bg-white transition-transform ${item.inStock ? "translate-x-8" : "translate-x-0"}`}
								/>
							</button>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => {
										removeSellerProduct(item._id ?? item.id);
										toast.success("Product removed");
									}}
									className="px-3 py-1.5 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
								>
									Delete
								</button>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default Productlist;
