import React from 'react';
import { Link } from 'react-router-dom';
import { assets } from '../assets/assets';
import { useAppContext } from '../context/AppContext';
import { calculateTotals } from '../utils/calculateTotals';

const getWeightLabel = (name) => {
  const match = String(name || '').match(/(\d+(?:\.\d+)?\s?(?:kg|g|ml|l))/i);
  return match ? match[1] : 'N/A';
};

const Cart = () => {
  const { cart, removeFromCart, updateQuantity, cartTotal, currency } = useAppContext();
  const { deliveryCharge, amountToFreeShipping, shippingProgress, tax, totalAmount } = calculateTotals(cartTotal);

  const getCartItemImage = (item) => {
    if (Array.isArray(item?.image) && item.image.length > 0) return item.image[0];
    if (typeof item?.image === 'string' && item.image) return item.image;
    return assets.logo;
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">🛒</div>
          <h1 className="text-3xl font-bold mb-4">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-8">Add some fresh groceries to get started!</p>
          <Link
            to="/products"
            className="inline-block px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full transition"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] py-8 md:py-12">
      <div className="mx-auto w-full max-w-[1380px] px-4 md:px-8 lg:px-12">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-800 mb-8">
          Shopping Cart{' '}
          <span className="text-xl md:text-2xl text-emerald-500 font-semibold">{cart.length} Items</span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8 lg:gap-10 items-start">
          <section>
            <div className="hidden md:grid grid-cols-[1fr_160px_120px] text-lg text-gray-600 font-semibold px-2 pb-4 border-b border-gray-300">
              <p>Product Details</p>
              <p className="text-center">Subtotal</p>
              <p className="text-center">Action</p>
            </div>

            <div>
              {cart.map((item) => {
                const unitPrice = Number(item.offerPrice ?? item.price ?? 0);
                const imageSrc = getCartItemImage(item);
                const parsedStock = Number(item.stockQty ?? item.stock ?? 10);
                const stockLimit = Number.isFinite(parsedStock) && parsedStock > 0 ? Math.floor(parsedStock) : 10;
                const quantityOptions = Math.max(stockLimit, item.quantity || 1);
                return (
                  <article
                    key={item.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_160px_120px] gap-4 md:gap-2 py-6 border-b border-gray-200"
                  >
                    <div className="flex gap-4 md:gap-6">
                      <div className="w-24 h-24 md:w-28 md:h-28 rounded-md border border-gray-200 bg-white p-2 flex items-center justify-center">
                        <img
                          src={imageSrc}
                          alt={item.name}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="pt-1">
                        <h2 className="text-2xl font-semibold text-gray-700">{item.name}</h2>
                        <p className="text-gray-500 text-lg leading-tight">Weight: {getWeightLabel(item.name)}</p>
                        <div className="mt-1 flex items-center text-lg text-gray-600 leading-none">
                          <span className="mr-2">Qty:</span>
                          <select
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                            className="appearance-none bg-transparent border-none focus:outline-none pr-4 cursor-pointer"
                            aria-label={`Quantity for ${item.name}`}
                          >
                            {Array.from({ length: quantityOptions }, (_, index) => index + 1).map((qty) => (
                              <option key={qty} value={qty}>
                                {qty}
                              </option>
                            ))}
                          </select>
                          <span className="text-sm">⌄</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex md:items-center md:justify-center text-2xl font-semibold text-gray-700 pl-1 md:pl-0">
                      {currency}{unitPrice * item.quantity}
                    </div>

                    <div className="flex md:items-center md:justify-center pl-1 md:pl-0">
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-50 transition"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <img src={assets.remove_icon} alt="Remove" className="w-7 h-7" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <Link to="/products" className="inline-block mt-8 text-emerald-600 text-xl font-semibold hover:text-emerald-700 transition">
              ← Continue Shopping
            </Link>
          </section>

          <aside className="bg-[#efefef] p-6 md:p-8 lg:sticky lg:top-6">
            <h2 className="text-4xl font-semibold text-gray-800 mb-5">Order Summary</h2>
            <div className="border-t border-gray-300 pt-6">
              <div className="mb-8">
                <p className="text-3xl uppercase text-gray-700 font-semibold mb-2">Delivery Address</p>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg text-gray-600 leading-snug">Street 123, Main City, New State, IN</p>
                  <button type="button" className="text-emerald-500 text-lg font-semibold whitespace-nowrap hover:text-emerald-600 transition">
                    Change
                  </button>
                </div>
              </div>

              <div className="mb-8 pb-8 border-b border-gray-300">
                <p className="text-3xl uppercase text-gray-700 font-semibold mb-3">Payment Method</p>
                <select className="w-full border border-gray-300 bg-white px-4 py-3 text-xl text-gray-700">
                  <option>Online Payment</option>
                </select>
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-700 font-medium">Free Shipping Progress</span>
                  <span className="text-gray-600">{Math.round(shippingProgress)}%</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${shippingProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {amountToFreeShipping > 0
                    ? `Add ${currency}${amountToFreeShipping} more for Free Shipping!`
                    : 'You unlocked Free Shipping'}
                </p>
              </div>

              <div className="space-y-2 text-xl text-gray-600 mb-6">
                <div className="flex justify-between">
                  <span>Price</span>
                  <span>{currency}{cartTotal}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping Fee</span>
                  <span className="text-emerald-600 font-semibold">{deliveryCharge === 0 ? 'Free' : `${currency}${deliveryCharge}`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (2%)</span>
                  <span>{currency}{tax}</span>
                </div>
              </div>

              <div className="flex justify-between text-3xl font-semibold text-gray-700 mb-6">
                <span>Total Amount:</span>
                <span>{currency}{totalAmount}</span>
              </div>

              <Link
                to="/checkout"
                className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-white text-2xl font-semibold py-4 transition"
              >
                Place Order
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Cart;
