import React from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const MiniCartDrawer = () => {
  const { cart, currency, miniCartOpen, setMiniCartOpen } = useAppContext();

  const subtotal = cart.reduce((sum, item) => {
    const unitPrice = Number(item.offerPrice ?? item.price ?? 0);
    return sum + unitPrice * item.quantity;
  }, 0);

  return (
    <>
      {miniCartOpen ? (
        <button
          type="button"
          aria-label="Close mini cart"
          onClick={() => setMiniCartOpen(false)}
          className="fixed inset-0 bg-black/40 z-40"
        />
      ) : null}

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 shadow-2xl transform transition-transform duration-300 ${
          miniCartOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Cart Preview</h2>
            <button
              type="button"
              onClick={() => setMiniCartOpen(false)}
              className="text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {cart.length === 0 ? (
              <p className="text-gray-500">Your cart is empty.</p>
            ) : (
              cart.map((item) => {
                const unitPrice = Number(item.offerPrice ?? item.price ?? 0);
                const imageSrc = Array.isArray(item.image) ? item.image[0] : item.image;
                return (
                  <div key={item.id} className="flex gap-3 border border-gray-200 rounded-md p-3">
                    <img src={imageSrc} alt={item.name} className="w-16 h-16 object-contain" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      <p className="text-sm text-primary font-semibold mt-1">
                        {currency}{unitPrice * item.quantity}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-5 border-t border-gray-200">
            <div className="flex justify-between mb-4 text-gray-700">
              <span>Subtotal</span>
              <span className="font-semibold">{currency}{subtotal}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMiniCartOpen(false)}
                className="h-10 rounded border border-gray-300 text-gray-700"
              >
                Continue
              </button>
              <Link
                to="/cart"
                onClick={() => setMiniCartOpen(false)}
                className="h-10 rounded bg-primary text-white flex items-center justify-center"
              >
                View Cart
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default MiniCartDrawer;
