import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-green-600">FreshMart</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/" className="text-gray-700 hover:text-green-600">Home</Link>
              <Link href="/products" className="text-gray-700 hover:text-green-600">Products</Link>
              <Link href="/cart" className="text-gray-700 hover:text-green-600">Cart</Link>
              <Link href="/admin" className="text-gray-700 hover:text-green-600">Admin</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-green-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-6xl font-bold mb-6">
            Fresh Groceries Delivered Fast
          </h2>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Get your favorite groceries delivered to your doorstep in under 30 minutes.
            Fresh, organic, and affordable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/products"
              className="bg-white text-green-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Shop Now
            </Link>
            <button className="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-green-600 transition-colors">
              Download App
            </button>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center mb-12">Shop by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Fruits & Vegetables", icon: "🥕", color: "bg-green-100" },
              { name: "Dairy & Eggs", icon: "🥛", color: "bg-blue-100" },
              { name: "Meat & Seafood", icon: "🥩", color: "bg-red-100" },
              { name: "Bakery", icon: "🍞", color: "bg-yellow-100" },
              { name: "Pantry", icon: "🥫", color: "bg-purple-100" },
              { name: "Beverages", icon: "🥤", color: "bg-orange-100" },
              { name: "Snacks", icon: "🍿", color: "bg-pink-100" },
              { name: "Household", icon: "🧹", color: "bg-gray-100" }
            ].map((category) => (
              <div key={category.name} className={`${category.color} p-6 rounded-lg text-center hover:shadow-lg transition-shadow cursor-pointer`}>
                <div className="text-4xl mb-3">{category.icon}</div>
                <h4 className="font-semibold text-gray-800">{category.name}</h4>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-center mb-12">Featured Products</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Organic Bananas", price: "$2.99", image: "/next.svg", discount: "20% OFF" },
              { name: "Fresh Milk", price: "$3.49", image: "/next.svg", discount: "Buy 2 Get 1" },
              { name: "Whole Wheat Bread", price: "$4.99", image: "/next.svg", discount: "New" }
            ].map((product) => (
              <div key={product.name} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={300}
                    height={200}
                    className="w-full h-48 object-cover"
                  />
                  <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-sm">
                    {product.discount}
                  </span>
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-lg mb-2">{product.name}</h4>
                  <p className="text-green-600 font-bold text-xl">{product.price}</p>
                  <button className="mt-3 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition-colors">
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-xl font-bold mb-4">FreshMart</h4>
              <p className="text-gray-300">Your trusted grocery delivery partner</p>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Quick Links</h5>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/about" className="hover:text-white">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Categories</h5>
              <ul className="space-y-2 text-gray-300">
                <li><Link href="/products/fruits" className="hover:text-white">Fruits</Link></li>
                <li><Link href="/products/vegetables" className="hover:text-white">Vegetables</Link></li>
                <li><Link href="/products/dairy" className="hover:text-white">Dairy</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-4">Contact Info</h5>
              <p className="text-gray-300">📞 +1 (555) 123-4567</p>
              <p className="text-gray-300">📧 info@freshmart.com</p>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-300">
            <p>&copy; 2024 FreshMart. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
