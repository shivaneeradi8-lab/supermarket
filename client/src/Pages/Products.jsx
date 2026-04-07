import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../Components/ProductCard';

const Products = () => {
  const { products, productsLoading, sellerCategories, categoryImages } = useAppContext();
  const [searchParams] = useSearchParams();
  const activeProducts = products.filter((p) => p.inStock !== false);

  const categoryAliases = {
    Drinks: 'Drinks',
    Instant: 'Instant',
    Vegetables: 'Vegetables',
    Fruits: 'Fruits',
    Dairy: 'Dairy',
    Bakery: 'Bakery',
    Grains: 'Grains',
  };

  const initialCategoryParam = searchParams.get('category');
  const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();
  const initialCategory = initialCategoryParam
    ? categoryAliases[initialCategoryParam] || initialCategoryParam
    : 'All';

  const hasInitialCategory = activeProducts.some((p) => p.category === initialCategory);
  const startingCategory = hasInitialCategory ? initialCategory : 'All';

  const [selectedCategory, setSelectedCategory] = useState(startingCategory);

  const visibleProducts = useMemo(() => {
    const categoryFiltered = selectedCategory === 'All'
      ? activeProducts
      : activeProducts.filter((p) => p.category === selectedCategory);

    if (!searchQuery) return categoryFiltered;

    return categoryFiltered.filter((p) =>
      `${p.name} ${p.category}`.toLowerCase().includes(searchQuery)
    );
  }, [activeProducts, selectedCategory, searchQuery]);

  const categories = ['All', ...new Set([...sellerCategories, ...activeProducts.map((p) => p.category)])];

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="px-6 md:px-16 lg:px-24">
        <h1 className="text-4xl font-bold mb-8">All Products</h1>

        {/* Category Filter */}
        <div className="mb-8 flex flex-wrap gap-3">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryFilter(category)}
              className={`px-4 py-2 rounded-full transition flex items-center gap-2 ${
                selectedCategory === category
                  ? 'bg-green-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:border-green-600'
              }`}
            >
              {category !== 'All' && categoryImages[String(category).toLowerCase()] ? (
                <img
                  src={categoryImages[String(category).toLowerCase()]}
                  alt={category}
                  className="w-6 h-6 rounded-full object-cover border border-gray-200"
                />
              ) : null}
              {category}
            </button>
          ))}
        </div>

        {searchQuery ? (
          <p className="text-gray-600 mb-6">Search results for: <span className="font-medium">{searchQuery}</span></p>
        ) : null}

        {/* Products Grid */}
        {productsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="animate-pulse bg-white border border-gray-200 rounded-md p-4">
                <div className="h-40 bg-gray-100 rounded" />
                <div className="h-4 bg-gray-100 rounded mt-4 w-1/2" />
                <div className="h-6 bg-gray-100 rounded mt-3 w-2/3" />
                <div className="h-4 bg-gray-100 rounded mt-3 w-1/3" />
                <div className="h-9 bg-gray-100 rounded mt-5" />
              </div>
            ))}
          </div>
        ) : null}

        {!productsLoading && visibleProducts.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-600">
            No products are available for this category yet.
          </div>
        ) : (
        !productsLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
        )
        )}
      </div>
    </div>
  );
};

export default Products;
