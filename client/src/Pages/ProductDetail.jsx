import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { apiGet, apiPost } from '../lib/api';

const getWeightLabel = (name) => {
  const match = String(name || '').match(/(\d+(?:\.\d+)?\s?(?:kg|g|ml|l))/i);
  return match ? match[1] : 'N/A';
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, cart, addToCart, updateQuantity, currency, buyNow, productsLoading, user } = useAppContext();

  const product = products.find((item) => String(item._id ?? item.id) === String(id)) || products[0];
  const productId = product?.id ?? product?._id;
  const cartItem = cart.find((item) => String(item.id) === String(productId));
  const quantity = cartItem?.quantity || 0;

    const [reviews, setReviews] = useState([]);
    const [reviewsMeta, setReviewsMeta] = useState(null);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
    const [reviewHover, setReviewHover] = useState(0);
    const [submittingReview, setSubmittingReview] = useState(false);

    useEffect(() => {
      if (!productId) return;
      let mounted = true;
      setReviewsLoading(true);
      apiGet(`/api/reviews?productId=${productId}&limit=10`).then((res) => {
        if (!mounted) return;
        if (res?.success) { setReviews(res.data || []); setReviewsMeta(res.meta || null); }
        setReviewsLoading(false);
      });
      return () => { mounted = false; };
    }, [productId]);

    const handleReviewSubmit = async (e) => {
      e.preventDefault();
      if (!user) { toast.error('Please log in to leave a review.'); return; }
      if (!reviewForm.rating) { toast.error('Please select a star rating.'); return; }
      setSubmittingReview(true);
      const res = await apiPost('/api/reviews', { productId, rating: reviewForm.rating, comment: reviewForm.comment });
      setSubmittingReview(false);
      if (res?.success) {
        toast.success('Review submitted!');
        setReviewForm({ rating: 0, comment: '' });
        const updated = await apiGet(`/api/reviews?productId=${productId}&limit=10`);
        if (updated?.success) { setReviews(updated.data || []); setReviewsMeta(updated.meta || null); }
      } else {
        toast.error(res?.message || 'Failed to submit review');
      }
    };
  const maxQty = Number(product?.stockQty ?? product?.stock ?? 10);
  const productImages = Array.isArray(product?.image) ? product.image : [product?.image].filter(Boolean);
  const [activeImage, setActiveImage] = useState(productImages[0]);

  useEffect(() => {
    setActiveImage(productImages[0]);
  }, [id, productImages]);

  if (productsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="px-6 md:px-16 lg:px-24">
          <div className="animate-pulse bg-white rounded-lg border border-gray-200 p-8">
            <div className="h-10 bg-gray-100 rounded w-1/3 mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-100 rounded" />
              <div className="space-y-4">
                <div className="h-10 bg-gray-100 rounded w-2/3" />
                <div className="h-6 bg-gray-100 rounded w-1/3" />
                <div className="h-8 bg-gray-100 rounded w-1/2" />
                <div className="h-24 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="px-6 md:px-16 lg:px-24 text-center text-gray-600">Product not found.</div>
      </div>
    );
  }

  const handleAddToCart = () => {
    if (quantity >= maxQty) {
      toast.error(`Only ${maxQty} in stock`);
      return;
    }
    addToCart(product);
    toast.success('Added to cart');
  };

  const handleBuyNow = () => {
    toast.success('Opening cart');
    buyNow(product);
  };

  const handleDecreaseQuantity = () => {
    if (!productId || quantity <= 0) return;
    updateQuantity(productId, quantity - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="px-6 md:px-16 lg:px-24">
        <button
          onClick={() => navigate(-1)}
          className="text-green-600 hover:text-green-700 font-bold mb-8"
        >
          ← Back
        </button>

        <p className="text-gray-600 mb-6">
          Home / Products / {product.category} / <span className="text-primary">{product.name}</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 bg-gradient-to-b from-green-50 to-white rounded-lg shadow-lg p-6 md:p-12 items-center">
          <div className="order-1 md:order-1 grid grid-cols-[84px_1fr] gap-4">
            <div className="space-y-3">
              {productImages.map((img, index) => (
                <button
                  key={`${product._id}-${index}`}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`border rounded-md p-1 w-20 h-20 bg-white ${activeImage === img ? 'border-primary' : 'border-gray-200'}`}
                >
                  <img src={img} alt={`${product.name}-${index + 1}`} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>

            <div className="h-72 md:h-96 bg-white border border-gray-200 flex items-center justify-center rounded-lg overflow-hidden">
              <img src={activeImage || productImages[0]} alt={product.name} className="max-h-full max-w-full object-contain" />
            </div>
          </div>

          <div className="order-2 md:order-2">
            <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-bold mb-4">
              {product.category}
            </span>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">{product.name}</h1>
            <p className="text-gray-600 -mt-2 mb-4">Weight: {getWeightLabel(product.name)}</p>
            <div className="flex items-center gap-1 text-[#4fbf8b] mb-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i}>{(product.rating || 4) > i ? '★' : '☆'}</span>
              ))}
              <span className="text-gray-600 ml-1">({product.rating || 4})</span>
            </div>

            <div className="mb-8">
              <p className="text-gray-700 text-sm mb-2">MRP: <span className="line-through">{currency} {product.price}</span></p>
              <p className="text-4xl font-bold text-gray-900">MRP: {currency} {product.offerPrice}</p>
              <p className="text-gray-500 mt-1">(inclusive of all taxes)</p>
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">About Product</h3>
              <ul className="list-disc pl-6 text-gray-600 space-y-1">
                {(product.description || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mb-8">
              <label className="block text-gray-700 font-bold mb-3">Quantity</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleDecreaseQuantity}
                  className="w-12 h-12 border border-gray-300 hover:border-green-600 rounded flex items-center justify-center text-xl transition"
                >
                  −
                </button>
                <input
                  type="number"
                  value={quantity}
                  readOnly
                  min={0}
                  max={maxQty}
                  className="w-20 text-center border border-gray-300 rounded py-2 text-lg"
                />
                <button
                  onClick={handleAddToCart}
                  disabled={quantity >= maxQty}
                  className="w-12 h-12 border border-gray-300 hover:border-green-600 rounded flex items-center justify-center text-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-4 rounded transition text-lg"
              >
                Add to Cart
              </button>
              <button
                type="button"
                onClick={handleBuyNow}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded transition text-lg"
              >
                Buy now
              </button>
            </div>
          </div>
        </div>
      </div>

          {/* ── Reviews Section ── */}
          <div className="mt-10 bg-white rounded-lg border border-gray-200 p-6 md:p-10">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Customer Reviews</h2>
              {reviewsMeta && (
                <div className="flex items-center gap-1 text-[#4fbf8b]">
                  {'★'.repeat(Math.round(reviewsMeta.avgRating))}{'☆'.repeat(5 - Math.round(reviewsMeta.avgRating))}
                  <span className="text-gray-600 ml-1 text-sm">{reviewsMeta.avgRating} ({reviewsMeta.totalReviews} reviews)</span>
                </div>
              )}
            </div>

            {/* Write a review */}
            <form onSubmit={handleReviewSubmit} className="bg-gray-50 rounded-xl p-5 mb-8 space-y-3">
              <h3 className="font-semibold text-gray-700">Write a Review</h3>
              <div className="flex gap-1">
                {[1,2,3,4,5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewForm((p) => ({ ...p, rating: star }))}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                    className="text-2xl focus:outline-none"
                  >
                    <span className={(reviewHover || reviewForm.rating) >= star ? 'text-amber-400' : 'text-gray-300'}>★</span>
                  </button>
                ))}
              </div>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Share your thoughts about this product… (optional)"
                rows={3}
                maxLength={1000}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                {submittingReview ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>

            {/* Review list */}
            {reviewsLoading ? (
              <div className="space-y-4">
                {[1,2,3].map((i) => (
                  <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-20" />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-gray-400 text-sm">No reviews yet. Be the first!</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <div key={r._id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
                          {String(r.userName || 'U')[0].toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-700 text-sm">{r.userName}</span>
                        {r.verifiedPurchase && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">✓ Verified</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="flex gap-0.5 text-amber-400 text-sm mb-1">
                      {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                    </div>
                    {r.comment && <p className="text-gray-600 text-sm">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
    </div>
  );
};

export default ProductDetail;
