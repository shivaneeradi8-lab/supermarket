import React from "react";
import ProductStockUpdater from "./ProductStockUpdater";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

const fallbackProduct = {
    _id: "fallback-item",
    name: "Fresh Basket Item",
    category: "Groceries",
    price: 100,
    offerPrice: 80,
    rating: 4,
    image: "https://raw.githubusercontent.com/prebuiltui/prebuiltui/main/assets/card/productImageWithoutBg.png",
    stockQty: 10,
};

const getWeightLabel = (name) => {
    const match = String(name || "").match(/(\d+(?:\.\d+)?\s?(?:kg|g|ml|l))/i);
    return match ? match[1] : "N/A";
};

const ProductCard = ({ product = fallbackProduct }) => {
    const { cart, currency, addToCart, updateQuantity, buyNow } = useAppContext();
    const navigate = useNavigate();
    const productId = product.id ?? product._id;
    const cartItem = cart.find((item) => item.id === productId);
    const count = cartItem?.quantity || 0;
    const imageSrc = Array.isArray(product.image) ? product.image[0] : product.image;
    const rating = product.rating || 4;
    const maxQty = Number(product.stockQty ?? product.stock ?? 10);
    const LOW_STOCK_THRESHOLD = 5;
    const showLowStock = maxQty > 0 && maxQty <= LOW_STOCK_THRESHOLD;

    const handleIncrease = () => {
        if (count >= maxQty) {
            toast.error(`Only ${maxQty} in stock`);
            return;
        }
        addToCart(product);
        toast.success("Added to cart");
    };

    const handleDecrease = () => {
        if (count <= 0) return;
        updateQuantity(productId, count - 1);
    };

    const goToProductDetails = () => {
        if (!productId) return;
        navigate(`/product/${productId}`);
    };

    const handleBuyNow = () => {
        toast.success("Opening cart");
        buyNow(product);
    };

    return (
        <div className="border border-gray-500/20 rounded-md md:px-4 px-3 py-2 bg-white w-full">
            {/* Stock Updater for Sellers/Admins */}
            {typeof product.stock !== 'undefined' && product._id && (
                <div className="mb-2">
                    <ProductStockUpdater productId={product._id} currentStock={product.stock} />
                </div>
            )}
            <button
                type="button"
                onClick={goToProductDetails}
                className="group cursor-pointer flex items-center justify-center h-44 w-full rounded-md bg-gray-50/70 overflow-hidden"
            >
                <img
                    className="group-hover:scale-105 transition duration-300 w-full h-full object-contain p-3"
                    src={imageSrc}
                    alt={product.name}
                    loading="lazy"
                />
            </button>
            <div className="text-gray-500/60 text-sm">
                <div className="flex items-center justify-between gap-2">
                    <p>{product.category}</p>
                    {showLowStock ? (
                        <span className="text-[11px] font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            Only {maxQty} left
                        </span>
                    ) : null}
                </div>
                <button type="button" onClick={goToProductDetails} className="text-gray-700 font-medium text-lg truncate w-full text-left">
                    {product.name}
                </button>
                <p className="text-xs text-gray-500 mt-0.5">Weight: {getWeightLabel(product.name)}</p>
                <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={rating > i ? "text-[#4fbf8b]" : "text-gray-300"}>
                            ★
                        </span>
                    ))}
                    <p>({rating})</p>
                </div>
                <div className="flex items-end justify-between mt-3">
                    <p className="md:text-xl text-base font-medium text-indigo-500">
                        {currency} {product.offerPrice}{" "}
                        <span className="text-gray-500/60 md:text-sm text-xs line-through">
                            {currency} {product.price}
                        </span>
                    </p>
                    <div className="text-indigo-500">
                        {count === 0 ? (
                            <button
                                type="button"
                                className="flex items-center justify-center gap-1 bg-indigo-100 border border-indigo-300 md:w-[80px] w-[64px] h-[34px] rounded text-indigo-600 font-medium"
                                onClick={handleIncrease}
                                disabled={maxQty <= 0}
                            >
                                Add
                            </button>
                        ) : (
                            <div className="flex items-center justify-center gap-2 md:w-20 w-16 h-[34px] bg-indigo-500/25 rounded select-none">
                                <button type="button" onClick={handleDecrease} className="cursor-pointer text-md px-2 h-full">
                                    -
                                </button>
                                <span className="w-5 text-center">{count}</span>
                                <button
                                    type="button"
                                    onClick={handleIncrease}
                                    className="cursor-pointer text-md px-2 h-full disabled:opacity-40"
                                    disabled={count >= maxQty}
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleBuyNow}
                    className="mt-3 w-full h-9 rounded bg-green-600 hover:bg-green-700 text-white font-medium"
                >
                    Buy now
                </button>
            </div>
        </div>
    );
};

export default ProductCard;