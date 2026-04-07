import { createContext, useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dummyProducts } from "../assets/assets";
import { apiGet, apiPost, apiPut, getToken, clearToken, isTokenValid, decodeToken } from "../lib/api";

export const AppContext = createContext();

const SELLER_PRODUCTS_KEY = "greencart_seller_products";
const HIDDEN_PRODUCTS_KEY = "greencart_hidden_product_ids";
const CART_STORAGE_KEY = "greencart_cart";
const STOCK_OVERRIDES_KEY = "greencart_stock_overrides";
const SELLER_CATEGORIES_KEY = "greencart_seller_categories";
const SELLER_CATEGORY_IMAGES_KEY = "greencart_category_images";
const USER_STORAGE_KEY = "greencart_user";
const DEFAULT_STOCK_QTY = 10;
const DEFAULT_PRODUCT_CATEGORIES = ["Bakery", "Vegetables", "Fruits", "Dairy", "Drinks", "Instant", "Grains"];

const normalizeCategoryName = (value) => String(value || "").trim().replace(/\s+/g, " ");
const hasSellerAccess = (nextUser) => ["seller", "admin"].includes(String(nextUser?.role || "").toLowerCase());

const mergeCategories = (...categoryLists) => {
    const merged = [];
    const seen = new Set();

    categoryLists.flat().forEach((category) => {
        const normalized = normalizeCategoryName(category);
        if (!normalized) return;

        const key = normalized.toLowerCase();
        if (seen.has(key)) return;

        seen.add(key);
        merged.push(normalized);
    });

    return merged;
};

const getProductId = (productOrId) => {
    if (typeof productOrId === "string" || typeof productOrId === "number") return productOrId;
    return productOrId?.id ?? productOrId?._id;
};

const getUnitPrice = (item) => Number(item?.offerPrice ?? item?.price ?? 0);
const getStockLimit = (item) => {
    const limit = Number(item?.availableStock ?? item?.stockQty ?? item?.stock ?? DEFAULT_STOCK_QTY);
    return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_STOCK_QTY;
};

const isSellerCreatedProduct = (product) =>
    String(product?._id ?? product?.id ?? "").startsWith("seller-");

const createLocalSellerProduct = (productPayload, category) => {
    const nextId = `seller-${Date.now()}`;
    const availableStock = Number(productPayload.availableStock ?? getStockLimit(productPayload));
    const currentStock = Number(productPayload.currentStock ?? availableStock);

    return {
        _id: nextId,
        id: nextId,
        name: productPayload.name,
        description: Array.isArray(productPayload.description)
            ? productPayload.description
            : String(productPayload.description || "")
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
        category,
        image: Array.isArray(productPayload.images) ? productPayload.images.filter(Boolean) : [],
        price: Number(productPayload.price ?? 0),
        offerPrice: Number(productPayload.offerPrice ?? productPayload.price ?? 0),
        currentStock: Number.isFinite(currentStock) ? Math.max(0, Math.floor(currentStock)) : DEFAULT_STOCK_QTY,
        availableStock: Number.isFinite(availableStock) ? Math.max(0, Math.floor(availableStock)) : DEFAULT_STOCK_QTY,
        stockQty: Number.isFinite(availableStock) ? Math.max(0, Math.floor(availableStock)) : DEFAULT_STOCK_QTY,
        salePrice: Number(productPayload.salePrice ?? 0),
        isSaleActive: Boolean(productPayload.isSaleActive),
        inStock: Number(availableStock) > 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
};

const loadJsonArray = (key) => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const saveJsonArray = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore storage errors (private mode or quota limit).
    }
};

const loadSellerProductsFromStorage = () => loadJsonArray(SELLER_PRODUCTS_KEY);

const saveSellerProductsToStorage = (products) => {
    const onlySellerCreated = products.filter(isSellerCreatedProduct);
    saveJsonArray(SELLER_PRODUCTS_KEY, onlySellerCreated);
};

const loadHiddenProductIdsFromStorage = () => loadJsonArray(HIDDEN_PRODUCTS_KEY).map(String);
const loadCartFromStorage = () => loadJsonArray(CART_STORAGE_KEY);

/**
 * Restores the logged-in user from localStorage on app start.
 * Returns null if the stored token is missing or expired.
 */
const loadUserFromStorage = () => {
    try {
        const token = localStorage.getItem("greencart_token");
        if (!isTokenValid(token)) {
            localStorage.removeItem("greencart_token");
            localStorage.removeItem(USER_STORAGE_KEY);
            return null;
        }
        const raw = localStorage.getItem(USER_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
};

/**
 * Maps a product from the Next.js / MongoDB shape to the shape the
 * Vite app expects internally.
 */
const mapApiProduct = (p) => ({
    ...p,
    id: String(p._id),
    // Backend price is base price; offerPrice is active sale/effective price for storefront display.
    offerPrice:
        p.isSaleActive && Number.isFinite(Number(p.salePrice))
            ? Number(p.salePrice)
            : Number(p.effectivePrice ?? p.price ?? 0),
    price: Number(p.originalPrice ?? p.price ?? 0),
    currentStock: Number.isFinite(Number(p.currentStock))
        ? Math.max(0, Math.floor(Number(p.currentStock)))
        : Number.isFinite(Number(p.stock))
        ? Math.max(0, Math.floor(Number(p.stock)))
        : DEFAULT_STOCK_QTY,
    availableStock: Number.isFinite(Number(p.stock))
        ? Math.max(0, Math.floor(Number(p.stock)))
        : DEFAULT_STOCK_QTY,
    stockQty: Number.isFinite(Number(p.stock)) ? Math.max(0, Math.floor(Number(p.stock))) : DEFAULT_STOCK_QTY,
    salePrice: Number.isFinite(Number(p.salePrice)) ? Number(p.salePrice) : 0,
    isSaleActive: Boolean(p.isSaleActive),
    inStock: p.isActive !== false && Number(p.stock ?? 0) > 0,
    // API stores image as a single string; the app expects an array.
    image: p.image ? [p.image] : [],
    description:
        typeof p.description === "string"
            ? p.description.split("\n").map((l) => l.trim()).filter(Boolean)
            : Array.isArray(p.description)
            ? p.description
            : [],
});
const loadSellerCategoriesFromStorage = () =>
    mergeCategories(DEFAULT_PRODUCT_CATEGORIES, loadJsonArray(SELLER_CATEGORIES_KEY));

const loadCategoryImagesFromStorage = () => {
    try {
        const raw = localStorage.getItem(SELLER_CATEGORY_IMAGES_KEY);
        if (!raw) return {};

        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const saveSellerCategoriesToStorage = (categories) => {
    saveJsonArray(SELLER_CATEGORIES_KEY, mergeCategories(categories));
};

const saveCategoryImagesToStorage = (categoryImages) => {
    try {
        localStorage.setItem(SELLER_CATEGORY_IMAGES_KEY, JSON.stringify(categoryImages));
    } catch {
        // Ignore storage errors (private mode or quota limit).
    }
};

const loadStockOverridesFromStorage = () => {
    try {
        const raw = localStorage.getItem(STOCK_OVERRIDES_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
};

const saveStockOverridesToStorage = (stockOverrides) => {
    try {
        localStorage.setItem(STOCK_OVERRIDES_KEY, JSON.stringify(stockOverrides));
    } catch {
        // Ignore storage errors (private mode or quota limit).
    }
};

const saveHiddenProductIdsToStorage = (hiddenIds) => {
    saveJsonArray(HIDDEN_PRODUCTS_KEY, Array.from(new Set(hiddenIds.map(String))));
};

const applyHiddenStatus = (allProducts, hiddenIds) => {
    const hiddenSet = new Set(hiddenIds.map(String));
    return allProducts.map((product) => {
        const productId = String(product._id ?? product.id);
        return hiddenSet.has(productId)
            ? { ...product, inStock: false }
            : { ...product, inStock: product.inStock !== false };
    });
};

const applyStockOverrides = (allProducts, stockOverrides) => allProducts.map((product) => {
    const productId = String(product._id ?? product.id);
    if (!(productId in stockOverrides)) return product;

    const nextStock = Number(stockOverrides[productId]);
    const stockQty = Number.isFinite(nextStock) ? Math.max(0, Math.floor(nextStock)) : getStockLimit(product);
    return { ...product, stockQty };
});

export const AppContextProvider = ({ children }) => {
    const currency = import.meta.env.VITE_currency || "Rs";
    const navigate = useNavigate();
    const [user, setUser] = useState(loadUserFromStorage);
    const [isSeller, setIsSeller] = useState(() => hasSellerAccess(loadUserFromStorage()));
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [cart, setCart] = useState(loadCartFromStorage);
    const [cartTotal, setCartTotal] = useState(0);
    const [products, setProducts] = useState([]);
    const [sellerProducts, setSellerProducts] = useState([]);
    const [sellerCategories, setSellerCategories] = useState(loadSellerCategoriesFromStorage);
    const [categoryImages, setCategoryImages] = useState(loadCategoryImagesFromStorage);
    const [productsLoading, setProductsLoading] = useState(true);
    const [miniCartOpen, setMiniCartOpen] = useState(false);


    const fetchProduct = async () => {
        setProductsLoading(true);

        let mergedProducts = null;

        try {
            let url = "/api/products?limit=100";
            if (isSeller && user?._id) {
                url += `&seller=${user._id}`;
            }
            const result = await apiGet(url);
            if (result.success && Array.isArray(result.data) && result.data.length > 0) {
                const storedSellerProducts = loadSellerProductsFromStorage();
                const apiProducts = result.data.map(mapApiProduct);
                mergedProducts = [...storedSellerProducts, ...apiProducts];
            }
        } catch {
            // Next.js server is not running – fall through to dummy data.
        }

        if (!mergedProducts) {
            // Fallback: local dummy data + any seller products saved in localStorage.
            const storedSellerProducts = loadSellerProductsFromStorage();
            const hiddenProductIds = loadHiddenProductIdsFromStorage();
            const stockOverrides = loadStockOverridesFromStorage();
            mergedProducts = applyStockOverrides(
                applyHiddenStatus([...storedSellerProducts, ...dummyProducts], hiddenProductIds),
                stockOverrides
            );
        }

        const categoriesFromProducts = mergedProducts.map((item) => item.category);
        setSellerCategories((prev) => mergeCategories(DEFAULT_PRODUCT_CATEGORIES, prev, categoriesFromProducts));

        setProducts(mergedProducts);
        setSellerProducts(mergedProducts);

        // Keep cart stock limits aligned with latest product inventory values.
        setCart((prevCart) => prevCart.map((item) => {
            const matched = mergedProducts.find((product) => String(product._id ?? product.id) === String(item.id));
            if (!matched) return item;
            return { ...item, stockQty: getStockLimit(matched) };
        }));

        setProductsLoading(false);
    };

    useEffect(() => {
        fetchProduct();
    }, []);

    useEffect(() => {
        const token = getToken();
        if (!isTokenValid(token)) {
            setIsSeller(false);
            return;
        }

        const payload = decodeToken(token);
        if (payload?.role) {
            const role = String(payload.role).toLowerCase();
            if (["seller", "admin"].includes(role)) {
                setIsSeller(true);
            }
        }
    }, []);

    useEffect(() => {
        setIsSeller(hasSellerAccess(user));
    }, [user]);

    useEffect(() => {
        const total = cart.reduce((sum, item) => sum + getUnitPrice(item) * item.quantity, 0);
        setCartTotal(total);
    }, [cart]);

    useEffect(() => {
        saveJsonArray(CART_STORAGE_KEY, cart);
    }, [cart]);

    useEffect(() => {
        saveSellerCategoriesToStorage(sellerCategories);
    }, [sellerCategories]);

    useEffect(() => {
        saveCategoryImagesToStorage(categoryImages);
    }, [categoryImages]);

    const addToCart = (product) => {
        const productId = getProductId(product);
        if (!productId) return;

        setCart((prevCart) => {
            const existingItem = prevCart.find((item) => item.id === productId);
            if (existingItem) {
                const stockLimit = getStockLimit(existingItem);
                if (existingItem.quantity >= stockLimit) return prevCart;
                return prevCart.map((item) =>
                    item.id === productId
                        ? { ...item, quantity: Math.min(item.quantity + 1, stockLimit) }
                        : item
                );
            }
            return [...prevCart, { ...product, id: productId, quantity: 1, stockQty: getStockLimit(product) }];
        });

        setMiniCartOpen(true);
    };

    const removeFromCart = (productId) => {
        setCart((prevCart) => prevCart.filter((item) => item.id !== productId));
    };

    const updateQuantity = (productId, quantity) => {
        if (quantity <= 0) {
            removeFromCart(productId);
            return;
        }

        setCart((prevCart) =>
            prevCart.map((item) =>
                item.id === productId
                    ? { ...item, quantity: Math.min(quantity, getStockLimit(item)) }
                    : item
            )
        );
    };

    const clearCart = () => {
        setCart([]);
    };

    /** Sign the user out: clear JWT token, persisted user data, and cart. */
    const logoutUser = () => {
        clearToken();
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        setIsSeller(false);
        setCart([]);
    };

    const buyNow = (product) => {
        const productId = getProductId(product);
        setMiniCartOpen(false);

        if (!productId) {
            navigate('/cart');
            return;
        }

        setCart((prevCart) => {
            const alreadyInCart = prevCart.some((item) => item.id === productId);
            if (alreadyInCart) return prevCart;
            return [...prevCart, { ...product, id: productId, quantity: 1, stockQty: getStockLimit(product) }];
        });

        navigate('/cart');
    };

    const addSellerProduct = (productPayload) => {
        const normalizedCategory = normalizeCategoryName(productPayload.category) || DEFAULT_PRODUCT_CATEGORIES[0];

        const saveToState = (product) => {
            setSellerProducts((prev) => {
                const next = [product, ...prev];
                saveSellerProductsToStorage(next);
                return next;
            });

            setProducts((prev) => [product, ...prev]);
            setSellerCategories((prev) => mergeCategories(DEFAULT_PRODUCT_CATEGORIES, prev, [normalizedCategory]));
        };

        const payload = {
            name: productPayload.name,
            description: productPayload.description,
            category: normalizedCategory,
            image: Array.isArray(productPayload.images) ? productPayload.images[0] : productPayload.images,
            price: Number(productPayload.price),
            originalPrice: Number(productPayload.offerPrice ?? productPayload.price),
            currentStock: Number(productPayload.currentStock ?? getStockLimit(productPayload)),
            stock: Number(productPayload.availableStock ?? getStockLimit(productPayload)),
            salePrice: Number(productPayload.salePrice ?? 0),
            isSaleActive: Boolean(productPayload.isSaleActive),
        };

        const saveLocalFallback = (message = "Product added locally") => {
            const localProduct = createLocalSellerProduct(productPayload, normalizedCategory);
            saveToState(localProduct);
            return { success: true, data: localProduct, localOnly: true, message };
        };

        return apiPost("/api/products", payload)
            .then((result) => {
                if (result?.success && result?.data?._id) {
                    const normalized = mapApiProduct(result.data);
                    saveToState(normalized);
                    return { success: true, data: normalized };
                }

                if (
                    result?.status === 401 ||
                    result?.status === 403 ||
                    result?.status === 422
                ) {
                    return { success: false, message: result?.message || "Failed to create product" };
                }

                return saveLocalFallback(result?.message || "Backend unavailable. Product added locally");
            })
            .catch(() => {
                return saveLocalFallback("Backend unavailable. Product added locally");
            });
    };

    const updateSellerProductDetails = async (productId, updatePayload) => {
        const normalizedId = String(productId);
        const isLocalProduct = normalizedId.startsWith("seller-");

        const applyUpdateToState = (updated) => {
            const updater = (product) =>
                String(product._id ?? product.id) === normalizedId
                    ? {
                        ...product,
                        ...updated,
                        stockQty: Number(updated.availableStock ?? updated.stockQty ?? product.stockQty ?? 0),
                        updatedAt: new Date().toISOString(),
                    }
                    : product;

            setSellerProducts((prev) => {
                const next = prev.map(updater);
                saveSellerProductsToStorage(next);
                return next;
            });
            setProducts((prev) => prev.map(updater));
            setCart((prev) => prev.map(updater));
        };

        const saveLocalFallback = (message = "Product updated locally") => {
            applyUpdateToState(updatePayload);
            return { success: true, localOnly: true, message };
        };

        if (isLocalProduct) {
            applyUpdateToState(updatePayload);
            return { success: true, localOnly: true };
        }

        const requestPayload = {
            ...(typeof updatePayload.currentStock === "number" ? { currentStock: updatePayload.currentStock } : {}),
            ...(typeof updatePayload.availableStock === "number" ? { stock: updatePayload.availableStock } : {}),
            ...(typeof updatePayload.salePrice === "number" ? { salePrice: updatePayload.salePrice } : {}),
            ...(typeof updatePayload.isSaleActive === "boolean" ? { isSaleActive: updatePayload.isSaleActive } : {}),
        };

        const result = await apiPut(`/api/products/${normalizedId}`, requestPayload);
        if (!result?.success || !result?.data) {
            if (
                result?.status === 401 ||
                result?.status === 403 ||
                result?.status === 422
            ) {
                return { success: false, message: result?.message || "Failed to update product" };
            }

            return saveLocalFallback(result?.message || "Backend unavailable. Product updated locally");
        }

        const normalized = mapApiProduct(result.data);
        applyUpdateToState(normalized);
        return { success: true, data: normalized };
    };

    const fetchDailyXReport = async (dateValue = "") => {
        const query = String(dateValue || "").trim();
        const path = query ? `/api/reports/x?date=${encodeURIComponent(query)}` : "/api/reports/x";
        try {
            const result = await apiGet(path);
            return result;
        } catch {
            return { success: false, message: "Failed to fetch X-report" };
        }
    };

    const addSellerCategory = (categoryName, categoryImage) => {
        const normalized = normalizeCategoryName(categoryName);

        if (!normalized) {
            return { ok: false, message: "Category name is required" };
        }

        const existingCategory = sellerCategories.find(
            (category) => category.toLowerCase() === normalized.toLowerCase()
        );

        if (existingCategory) {
            if (categoryImage) {
                setCategoryImages((prev) => ({
                    ...prev,
                    [existingCategory.toLowerCase()]: categoryImage,
                }));
            }
            return { ok: true, category: existingCategory, created: false };
        }

        setSellerCategories((prev) => mergeCategories(DEFAULT_PRODUCT_CATEGORIES, prev, [normalized]));

        if (categoryImage) {
            setCategoryImages((prev) => ({
                ...prev,
                [normalized.toLowerCase()]: categoryImage,
            }));
        }

        return { ok: true, category: normalized, created: true };
    };

    const removeSellerCategory = (categoryName) => {
        const normalized = normalizeCategoryName(categoryName);

        if (!normalized) {
            return { ok: false, message: "Category name is required" };
        }

        const isDefaultCategory = DEFAULT_PRODUCT_CATEGORIES.some(
            (category) => category.toLowerCase() === normalized.toLowerCase()
        );

        if (isDefaultCategory) {
            return { ok: false, message: "Default categories cannot be deleted" };
        }

        const isUsedByProduct = products.some(
            (item) => String(item.category || "").toLowerCase() === normalized.toLowerCase()
        );

        if (isUsedByProduct) {
            return { ok: false, message: "Category is used by products. Change or delete those products first" };
        }

        setSellerCategories((prev) => prev.filter(
            (category) => category.toLowerCase() !== normalized.toLowerCase()
        ));
        setCategoryImages((prev) => {
            const next = { ...prev };
            delete next[normalized.toLowerCase()];
            return next;
        });

        return { ok: true, removedCategory: normalized, fallbackCategory: DEFAULT_PRODUCT_CATEGORIES[0] };
    };

    const bulkUpdateProductStock = (stockUpdates) => {
        const normalizedUpdates = Object.entries(stockUpdates || {}).reduce((acc, [key, value]) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) return acc;
            acc[String(key)] = Math.max(0, Math.floor(parsed));
            return acc;
        }, {});

        const nextOverrides = {
            ...loadStockOverridesFromStorage(),
            ...normalizedUpdates,
        };
        saveStockOverridesToStorage(nextOverrides);

        const updateStock = (product) => {
            const productId = String(product._id ?? product.id);
            if (!(productId in normalizedUpdates)) return product;
            return { ...product, stockQty: normalizedUpdates[productId] };
        };

        setProducts((prev) => prev.map(updateStock));
        setSellerProducts((prev) => prev.map(updateStock));
        setCart((prev) => prev.map(updateStock));
    };

    const toggleSellerProductStock = (productId) => {
        const normalizedId = String(productId);
        const hiddenIds = new Set(loadHiddenProductIdsFromStorage());

        if (hiddenIds.has(normalizedId)) {
            hiddenIds.delete(normalizedId);
        } else {
            hiddenIds.add(normalizedId);
        }

        saveHiddenProductIdsToStorage(Array.from(hiddenIds));

        const toggleStock = (product) =>
            String(product._id ?? product.id) === normalizedId
                ? { ...product, inStock: !product.inStock, updatedAt: new Date().toISOString() }
                : product;

        setSellerProducts((prev) => {
            const next = prev.map(toggleStock);
            saveSellerProductsToStorage(next);
            return next;
        });

        setProducts((prev) => prev.map(toggleStock));
    };

    const removeSellerProduct = (productId) => {
        const normalizedId = String(productId);
        const byDifferentId = (product) => String(product._id ?? product.id) !== normalizedId;

        const hiddenIds = new Set(loadHiddenProductIdsFromStorage());
        hiddenIds.delete(normalizedId);
        saveHiddenProductIdsToStorage(Array.from(hiddenIds));

        setSellerProducts((prev) => {
            const next = prev.filter(byDifferentId);
            saveSellerProductsToStorage(next);
            return next;
        });

        setProducts((prev) => prev.filter(byDifferentId));
    };

    const value = {
        navigate,
        user,
        setUser,
        isSeller,
        setIsSeller,
        cart,
        setCart,
        cartTotal,
        setCartTotal,
        products,
        productsLoading,
        currency,
        addToCart,
        buyNow,
        removeFromCart,
        updateQuantity,
        clearCart,
        showLoginModal,
        setShowLoginModal,
        sellerProducts,
        sellerCategories,
        categoryImages,
        addSellerProduct,
        addSellerCategory,
        removeSellerCategory,
        toggleSellerProductStock,
        removeSellerProduct,
        bulkUpdateProductStock,
        updateSellerProductDetails,
        fetchDailyXReport,
        fetchProduct,
        miniCartOpen,
        setMiniCartOpen,
        logoutUser,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppContext must be used within AppContextProvider");
    }
    return context;
};
