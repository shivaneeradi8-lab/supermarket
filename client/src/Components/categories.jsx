import React from "react";
import { useNavigate } from "react-router-dom";
import { categories as defaultCategories } from "../assets/assets";
import { useAppContext } from "../context/AppContext";

const FALLBACK_CATEGORY_COLORS = [
    "#EAF7F0",
    "#EAF3FF",
    "#FFF3E8",
    "#F2EEFF",
    "#FFF7E8",
    "#EAF8FB",
];

const Categories = () => {
    const navigate = useNavigate();
    const { sellerCategories, categoryImages } = useAppContext();

    const handleCategoryClick = (categoryPath) => {
        navigate(`/products?category=${encodeURIComponent(categoryPath)}`);
        window.scrollTo(0, 0);
    };

    const knownCategoryKeys = new Set(defaultCategories.map((category) => String(category.path).toLowerCase()));
    const customCategories = sellerCategories
        .filter((category) => !knownCategoryKeys.has(String(category).toLowerCase()))
        .map((category, index) => ({
            text: category,
            path: category,
            bgColor: FALLBACK_CATEGORY_COLORS[index % FALLBACK_CATEGORY_COLORS.length],
            image: categoryImages[String(category).toLowerCase()] || null,
        }));

    const displayCategories = [...defaultCategories, ...customCategories];

    return (
        <section className="px-6 md:px-16 lg:px-24 py-12 bg-white">
            <h2 className="text-3xl font-bold mb-8">Browse Popular Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 md:gap-5">
                {displayCategories.map((category) => (
                    <button
                        key={category.path}
                        type="button"
                        className="group cursor-pointer py-5 px-3 gap-2 rounded-lg flex flex-col justify-center items-center w-full"
                        style={{ backgroundColor: category.bgColor }}
                        onClick={() => handleCategoryClick(category.path)}
                    >
                        {category.image ? (
                            <img
                                src={category.image}
                                alt={category.text}
                                className="transition group-hover:scale-105 max-w-20 md:max-w-24"
                            />
                        ) : (
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/80 text-primary flex items-center justify-center text-2xl font-semibold transition group-hover:scale-105">
                                {String(category.text).charAt(0).toUpperCase()}
                            </div>
                        )}
                        <p className="text-sm font-medium text-center">{category.text}</p>
                    </button>
                ))}
            </div>
        </section>
    );
};

export default Categories;