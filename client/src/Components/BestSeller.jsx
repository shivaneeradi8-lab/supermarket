import React from "react";
import ProductCard from "./ProductCard";
import { useAppContext } from "../context/AppContext";
import { dummyOrders } from "../assets/assets";

const BestSeller = () => {
	const { products, productsLoading } = useAppContext();

    const bestSellers = React.useMemo(() => {
        const soldById = {};

        dummyOrders.forEach((order) => {
            (order.items || []).forEach((line) => {
                const product = line?.product;
                const productId = String(product?._id ?? product?.id ?? "");
                if (!productId) return;
                soldById[productId] = (soldById[productId] || 0) + Number(line.quantity || 0);
            });
        });

        return products
            .filter((item) => item.inStock)
            .map((item) => {
                const productId = String(item._id ?? item.id);
                return { ...item, soldQty: Number(soldById[productId] || 0) };
            })
            .sort((a, b) => {
                if (b.soldQty !== a.soldQty) return b.soldQty - a.soldQty;
                return Number(a.offerPrice ?? a.price ?? 0) - Number(b.offerPrice ?? b.price ?? 0);
            })
            .slice(0, 5);
    }, [products]);

    return (
        <section className="mt-16 bg-primary/10 border border-primary/20 rounded-2xl p-6 md:p-8">
                        <p className="text-2xl md:text-3xl font-medium mb-6 text-primary-dull">Best Sellers</p>

                        {productsLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                                {Array.from({ length: 5 }, (_, index) => (
                                    <div key={index} className="animate-pulse bg-white/80 border border-primary/20 rounded-md p-4">
                                        <div className="h-40 bg-gray-100 rounded" />
                                        <div className="h-4 bg-gray-100 rounded mt-4 w-1/2" />
                                        <div className="h-6 bg-gray-100 rounded mt-3 w-2/3" />
                                        <div className="h-9 bg-gray-100 rounded mt-5" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                            {bestSellers.map((product) => (
                                <ProductCard key={product._id} product={product} />
                            ))}
                        </div>
                        )}
        </section>
        );
};

export default BestSeller;
