import Image from "next/image";
import Link from "next/link";

const products = [
  {
    id: 1,
    name: "Organic Bananas",
    price: 2.99,
    originalPrice: 3.49,
    image: "/next.svg",
    category: "Fruits",
    rating: 4.5,
    inStock: true,
    discount: "15% OFF"
  },
  {
    id: 2,
    name: "Fresh Milk 1L",
    price: 3.49,
    originalPrice: 3.99,
    image: "/next.svg",
    category: "Dairy",
    rating: 4.8,
    inStock: true,
    discount: "12% OFF"
  },
  {
    id: 3,
    name: "Whole Wheat Bread",
    price: 4.99,
    originalPrice: 5.49,
    image: "/next.svg",
    category: "Bakery",
    rating: 4.3,
    inStock: true,
    discount: "9% OFF"
  },
  {
    id: 4,
    name: "Organic Tomatoes",
    price: 5.99,
    originalPrice: 6.99,
    image: "/next.svg",
    category: "Vegetables",
    rating: 4.6,
    inStock: true,
    discount: "14% OFF"
  },
  {
    id: 5,
    name: "Chicken Breast 500g",
    price: 12.99,
    originalPrice: 14.99,
    image: "/next.svg",
    category: "Meat",
    rating: 4.7,
    inStock: true,
    discount: "13% OFF"
  },
  {
    id: 6,
    name: "Orange Juice 1L",
    price: 4.49,
    originalPrice: 4.99,
    image: "/next.svg",
    category: "Beverages",
    rating: 4.4,
    inStock: false,
    discount: "10% OFF"
  }
];

export default function Products() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold text-green-600">FreshMart</Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-700 hover:text-green-600">Home</Link>
              <Link href="/products" className="text-green-600 font-semibold">Products</Link>
              <Link href="/cart" className="text-gray-700 hover:text-green-600">Cart</Link>
              <Link href="/admin" className="text-gray-700 hover:text-green-600">Admin</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Products Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
          <div className="flex space-x-4">
            <select className="border border-gray-300 rounded-md px-3 py-2">
              <option>All Categories</option>
              <option>Fruits</option>
              <option>Vegetables</option>
              <option>Dairy</option>
              <option>Meat</option>
              <option>Bakery</option>
            </select>
            <select className="border border-gray-300 rounded-md px-3 py-2">
              <option>Sort by: Featured</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Rating</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative">
                <Image
                  src={product.image}
                  alt={product.name}
                  width={300}
                  height={200}
                  className="w-full h-48 object-cover"
                />
                {product.discount && (
                  <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm font-semibold">
                    {product.discount}
                  </span>
                )}
                {!product.inStock && (
                  <span className="absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded text-sm">
                    Out of Stock
                  </span>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {product.category}
                  </span>
                  <div className="flex items-center">
                    <span className="text-yellow-400">★</span>
                    <span className="text-sm text-gray-600 ml-1">{product.rating}</span>
                  </div>
                </div>

                <h3 className="font-semibold text-lg mb-2 text-gray-900">{product.name}</h3>

                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-green-600 font-bold text-xl">${product.price}</span>
                  {product.originalPrice > product.price && (
                    <span className="text-gray-500 line-through text-sm">${product.originalPrice}</span>
                  )}
                </div>

                <button
                  className={`w-full py-2 px-4 rounded-md font-semibold transition-colors ${
                    product.inStock
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!product.inStock}
                >
                  {product.inStock ? 'Add to Cart' : 'Out of Stock'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex justify-center mt-12">
          <div className="flex space-x-2">
            <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Previous</button>
            <button className="px-3 py-2 bg-green-600 text-white border border-green-600 rounded-md">1</button>
            <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">2</button>
            <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">3</button>
            <button className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">Next</button>
          </div>
        </div>
      </main>
    </div>
  );
}