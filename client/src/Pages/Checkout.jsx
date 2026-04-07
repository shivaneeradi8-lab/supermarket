import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { calculateTotals } from '../utils/calculateTotals';
import { apiGet, apiPost, apiPut } from '../lib/api';

const UPI_ID = '6303846720@ibl';
const PAYEE_NAME = 'GreenCart';
const PENDING_ORDER_STORAGE_KEY = 'greencart_pending_order';
const LAST_PAID_ORDER_STORAGE_KEY = 'greencart_last_paid_order';
const QR_SESSION_SECONDS = 300;
const DEMO_CONFIRMATION_ENABLED = String(import.meta.env.VITE_DEMO_PAYMENT_CONFIRM || '').toLowerCase() === 'true';

const paymentOptions = [
  {
    value: 'phonepe',
    label: 'PhonePe',
    iconText: 'पे',
    iconClass: 'bg-[#5f259f] text-white',
    buildLink: (upiUrl) => `phonepe://pay?${upiUrl.split('?')[1]}`,
  },
  {
    value: 'gpay',
    label: 'GPay',
    iconText: 'G',
    iconClass: 'bg-white text-[#4285F4] border border-gray-200',
    buildLink: (upiUrl) => `tez://upi/pay?${upiUrl.split('?')[1]}`,
  },
  {
    value: 'paytm',
    label: 'Paytm',
    iconText: 'P',
    iconClass: 'bg-[#00b9f1] text-white',
    buildLink: (upiUrl) => `paytmmp://pay?${upiUrl.split('?')[1]}`,
  },
];

const PaymentOptionLogo = ({ option }) => (
  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold shadow-sm ${option.iconClass}`}>
    {option.iconText}
  </span>
);

const loadPendingOrder = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const buildUpiPaymentLinks = ({ amount, fullName, paymentMethod, orderId }) => {
  const selectedOption = paymentOptions.find((option) => option.value === paymentMethod) || paymentOptions[0];
  const immutableAmount = Number(amount || 0).toFixed(2);
  const normalizedOrderId = String(orderId || '').trim();

  const upiParams = new URLSearchParams({
    pa: UPI_ID,
    pn: PAYEE_NAME,
    am: immutableAmount,
    cu: 'INR',
    tn: `GreenCart order ${getOrderLabel(normalizedOrderId)} for ${fullName || 'customer'}`,
    tr: normalizedOrderId,
    tid: normalizedOrderId,
  });

  const upiUrl = `upi://pay?${upiParams.toString()}`;

  return {
    selectedOption,
    upiUrl,
    appLink: selectedOption.buildLink(upiUrl),
    immutableAmount,
  };
};

const getOrderLabel = (orderId) => `ORD-${String(orderId || '').slice(-8).toUpperCase()}`;

const toRemainingSeconds = (pendingOrder) => {
  const expiresAt = Number(pendingOrder?.expiresAt || 0);
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
};

const formatCountdown = (seconds) => {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, '0');
  const remainderSeconds = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainderSeconds}`;
};

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, cartTotal, clearCart, currency, fetchProduct, user, setShowLoginModal } = useAppContext();
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    zipCode: '',
    paymentMethod: 'phonepe'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [paymentDropdownOpen, setPaymentDropdownOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(loadPendingOrder);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const requestIdRef = React.useRef(null);

  const persistPendingOrder = (nextPendingOrder) => {
    setPendingOrder(nextPendingOrder);

    if (!nextPendingOrder) {
      sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
      return;
    }

    sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(nextPendingOrder));
  };

  const finalizePaidOrder = async (orderData) => {
    const paidSnapshot = {
      orderId: String(orderData?._id || pendingOrder?.orderId || ''),
      amount: Number(orderData?.totalPrice ?? pendingOrder?.amount ?? 0),
      paidAt: new Date().toISOString(),
    };

    sessionStorage.setItem(LAST_PAID_ORDER_STORAGE_KEY, JSON.stringify(paidSnapshot));
    clearCart();
    persistPendingOrder(null);
    setSessionExpired(false);
    await fetchProduct();
    toast.success('Payment verified by the server. Your order is confirmed.');
    navigate('/payment-success', { state: paidSnapshot });
  };

  const refreshPendingOrderStatus = async ({ silent = false } = {}) => {
    if (!pendingOrder?.orderId) return;

    setIsUpdatingPayment(true);

    try {
      const response = await apiGet(`/api/orders/${pendingOrder.orderId}`);

      if (!response?.success || !response?.data) {
        if (!silent) {
          toast.error(response?.message || 'Unable to fetch payment status');
        }
        return;
      }

      const nextStatus = response.data.status;

      if (nextStatus === 'success' || response.data.isPaid) {
        await finalizePaidOrder(response.data);
        return;
      }

      if (nextStatus === 'cancelled') {
        persistPendingOrder(null);
        await fetchProduct();
        if (!silent) {
          toast.error('Payment was cancelled or failed. Stock has been released.');
        }
      }
    } catch {
      if (!silent) {
        toast.error('Unable to refresh payment status right now');
      }
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const expirePendingSession = async () => {
    if (!pendingOrder?.orderId) return;

    setSessionExpired(true);

    try {
      await apiPut(`/api/orders/${pendingOrder.orderId}`, {
        action: 'cancel',
        paymentResult: {
          provider: pendingOrder.paymentMethod,
          reason: 'session_expired',
        },
      });
    } catch {
      // Best-effort cancellation. If backend is unreachable we still invalidate client session.
    }

    persistPendingOrder(null);
  };

  useEffect(() => {
    if (!pendingOrder?.orderId) return undefined;

    const statusIntervalId = window.setInterval(() => {
      refreshPendingOrderStatus({ silent: true });
    }, 5000);

    return () => window.clearInterval(statusIntervalId);
  }, [pendingOrder?.orderId]);

  useEffect(() => {
    if (!pendingOrder?.orderId) return undefined;

    const tickerId = window.setInterval(() => {
      setClockTick((prev) => prev + 1);
      const remainingSeconds = toRemainingSeconds(pendingOrder);
      if (remainingSeconds <= 0) {
        window.clearInterval(tickerId);
        void expirePendingSession();
      }
    }, 1000);

    return () => window.clearInterval(tickerId);
  }, [pendingOrder?.orderId, pendingOrder?.expiresAt]);

  const secondsLeft = useMemo(() => toRemainingSeconds(pendingOrder), [pendingOrder, clockTick]);

  const requiredAddressFields = ['fullName', 'phone', 'address', 'city', 'zipCode'];
  const isAddressComplete = requiredAddressFields.every((field) => String(formData[field] || '').trim());

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const selectPaymentMethod = (paymentMethod) => {
    setFormData((prev) => ({ ...prev, paymentMethod }));
    setPaymentDropdownOpen(false);
  };

  const openPaymentApp = (appLink, label) => {
    toast.success(`Opening ${label}. Complete the payment in the app, then return while we wait for provider confirmation.`);
    window.location.href = appLink;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAddressComplete) {
      toast.error('Please fill all fields');
      return;
    }

    if (!user) {
      toast.error('Please sign in before placing an order');
      setShowLoginModal(true);
      return;
    }

    if (pendingOrder?.orderId && toRemainingSeconds(pendingOrder) > 0) {
      openPaymentApp(pendingOrder.appLink, pendingOrder.paymentLabel);
      return;
    }

    setSessionExpired(false);
    setIsProcessing(true);
    requestIdRef.current = requestIdRef.current || (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);

    try {
      const orderResponse = await apiPost('/api/orders', {
        orderItems: cart.map((item) => ({
          product: item.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          fullName: formData.fullName,
          phone: formData.phone,
          street: formData.address,
          city: formData.city,
          zipCode: formData.zipCode,
          country: 'India',
        },
        paymentMethod: 'upi',
        paymentProvider: formData.paymentMethod,
        clientRequestId: requestIdRef.current,
      });

      if (!orderResponse?.success || !orderResponse?.data?._id) {
        toast.error(orderResponse?.message || 'Unable to create your order');
        return;
      }

      const orderId = String(orderResponse.data._id);
      const serverTotal = Number(orderResponse.data.totalPrice ?? 0);
      const { selectedOption, appLink, immutableAmount } = buildUpiPaymentLinks({
        amount: serverTotal,
        fullName: formData.fullName,
        paymentMethod: formData.paymentMethod,
        orderId,
      });

      const nextPendingOrder = {
        orderId,
        paymentMethod: formData.paymentMethod,
        paymentLabel: selectedOption.label,
        amount: immutableAmount,
        appLink,
        createdAt: Date.now(),
        expiresAt: Date.now() + QR_SESSION_SECONDS * 1000,
      };

      persistPendingOrder(nextPendingOrder);
      await fetchProduct();
      openPaymentApp(appLink, selectedOption.label);
    } catch {
      toast.error('Unable to start checkout right now');
    } finally {
      setIsProcessing(false);
      requestIdRef.current = null;
    }
  };

  const handleCancelPayment = async () => {
    if (!pendingOrder?.orderId) return;

    setIsUpdatingPayment(true);

    try {
      const response = await apiPut(`/api/orders/${pendingOrder.orderId}`, {
        action: 'cancel',
        paymentResult: {
          provider: pendingOrder.paymentMethod,
        },
      });

      if (!response?.success) {
        toast.error(response?.message || 'Unable to cancel payment');
        return;
      }

      persistPendingOrder(null);
      setSessionExpired(false);
      await fetchProduct();
      toast.success('Pending order cancelled and stock released.');
    } catch {
      toast.error('Unable to cancel this payment right now');
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  if (cart.length === 0 && !pendingOrder) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h1 className="text-3xl font-bold mb-4">No Items to Checkout</h1>
          <p className="text-gray-600 mb-8">Add items to your cart first</p>
          <Link
            to="/products"
            className="inline-block px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-full transition"
          >
            Shop Now
          </Link>
        </div>
      </div>
    );
  }

  const { deliveryCharge, tax, totalAmount } = calculateTotals(cartTotal);
  const displayAmount = Number(pendingOrder?.amount ?? totalAmount);
  const selectedPayment = paymentOptions.find((option) => option.value === formData.paymentMethod) || paymentOptions[0];
  const activeOrderId = String(pendingOrder?.orderId || requestIdRef.current || 'preview-order');
  const { upiUrl: qrUpiUrl } = buildUpiPaymentLinks({
    amount: displayAmount,
    fullName: formData.fullName || 'customer',
    paymentMethod: formData.paymentMethod,
    orderId: activeOrderId,
  });
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrUpiUrl)}`;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="px-6 md:px-16 lg:px-24">
        <h1 className="text-4xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Delivery Information */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6">Delivery Address</h2>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">Full Name *</label>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-600"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">Phone Number *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-600"
                      placeholder="9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-bold mb-2">Zip Code *</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-600"
                      placeholder="110001"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-gray-700 font-bold mb-2">Address *</label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-600"
                    placeholder="123 Main Street, Apartment 4B"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-2">Village Name *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:border-green-600"
                    placeholder="Enter village name"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold mb-6">Payment Method</h2>

                {!isAddressComplete ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6 text-sm text-gray-600">
                    Fill the delivery address first to unlock UPI payment apps and the QR scanner.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {pendingOrder && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Payment Pending</p>
                        <h3 className="mt-2 text-lg font-semibold">{getOrderLabel(pendingOrder.orderId)} is holding your stock</h3>
                        <p className="mt-2 text-sm text-amber-800">
                          Complete payment in {pendingOrder.paymentLabel}. Amount is locked at ₹{Number(pendingOrder.amount).toFixed(2)} and this QR expires in 5 minutes.
                        </p>
                        <p className="mt-3 inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                          Time left: {formatCountdown(secondsLeft)}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => openPaymentApp(pendingOrder.appLink, pendingOrder.paymentLabel)}
                            className="rounded-full bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800"
                          >
                            Reopen {pendingOrder.paymentLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => refreshPendingOrderStatus()}
                            disabled={isUpdatingPayment}
                            className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isUpdatingPayment ? 'Checking status...' : 'Check payment status'}
                          </button>
                          {DEMO_CONFIRMATION_ENABLED && (
                            <button
                              type="button"
                              onClick={async () => {
                                const fallbackOrder = {
                                  _id: pendingOrder.orderId,
                                  totalPrice: Number(pendingOrder.amount),
                                };
                                await finalizePaidOrder(fallbackOrder);
                              }}
                              disabled={isUpdatingPayment}
                              className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              I have paid (demo)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleCancelPayment}
                            disabled={isUpdatingPayment}
                            className="rounded-full border border-transparent px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel payment
                          </button>
                        </div>
                      </div>
                    )}

                    {sessionExpired && !pendingOrder && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5 text-sm text-red-900">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Session Expired</p>
                        <h3 className="mt-2 text-lg font-semibold">Your QR payment session expired after 5 minutes.</h3>
                        <p className="mt-2">Generate a fresh QR to continue with a new secured order session.</p>
                        <button
                          type="submit"
                          disabled={isProcessing || !isAddressComplete}
                          className="mt-4 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Regenerate QR
                        </button>
                      </div>
                    )}

                    <div className="relative">
                      <label className="block text-gray-700 font-bold mb-2">Choose UPI App</label>
                      <button
                        type="button"
                        onClick={() => setPaymentDropdownOpen((prev) => !prev)}
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-300 bg-white px-4 py-3 text-left shadow-sm"
                      >
                        <span className="flex items-center gap-3">
                          <PaymentOptionLogo option={selectedPayment} />
                          <span>
                            <span className="block text-base font-semibold text-gray-800">{selectedPayment.label}</span>
                            <span className="block text-sm text-gray-500">Tap pay to continue in {selectedPayment.label}</span>
                          </span>
                        </span>
                        <span className="text-xl text-gray-400">⌄</span>
                      </button>

                      {paymentDropdownOpen && (
                        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                          {paymentOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => selectPaymentMethod(option.value)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                            >
                              <PaymentOptionLogo option={option} />
                              <span className="font-medium text-gray-800">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[28px] bg-[#111111] p-5 text-white shadow-lg">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm uppercase tracking-[0.24em] text-emerald-300">Scanner</p>
                          <h3 className="mt-2 text-xl font-semibold">Scan and pay with any UPI app</h3>
                          <p className="mt-2 text-sm text-gray-300">The app button below opens {selectedPayment.label}. The scanner works across PhonePe, GPay and Paytm.</p>
                        </div>
                        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-emerald-200">₹{displayAmount.toFixed(2)}</span>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-[24px] bg-white p-4">
                        <img
                          src={qrCodeUrl}
                          alt="UPI payment QR code"
                          className="mx-auto w-full max-w-[320px] rounded-2xl"
                        />
                      </div>

                      <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">UPI ID</p>
                            <p className="mt-1 text-lg font-medium">{UPI_ID}</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(UPI_ID);
                              toast.success('UPI ID copied');
                            }}
                            className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-1 text-sm text-gray-200 sm:grid-cols-2">
                          <p>Order: <span className="font-semibold">{getOrderLabel(activeOrderId)}</span></p>
                          <p>Amount locked: <span className="font-semibold">₹{displayAmount.toFixed(2)}</span></p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isProcessing || isUpdatingPayment || !isAddressComplete}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition text-lg"
              >
                {isProcessing
                  ? 'Preparing secure checkout...'
                  : pendingOrder?.orderId
                  ? `Open ${pendingOrder.paymentLabel} again`
                  : `Pay with ${selectedPayment.label}`}
              </button>
            </form>
          </div>

          {/* Order Summary */}
          <div className="lg:sticky lg:top-6 h-fit">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-bold mb-6">Order Summary</h2>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="text-sm text-gray-600">
                  <p className="font-bold mb-3">{cart.length} items</p>
                  {cart.slice(0, 3).map((item, idx) => (
                    <p key={idx} className="flex justify-between mb-1">
                      <span>{item.name} x{item.quantity}</span>
                      <span>{currency}{Number(item.offerPrice ?? item.price ?? 0) * item.quantity}</span>
                    </p>
                  ))}
                  {cart.length > 3 && <p className="text-gray-500">+{cart.length - 3} more items</p>}
                </div>
              </div>

              <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{currency}{cartTotal}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery</span>
                  <span>{deliveryCharge === 0 ? 'Free' : `${currency}${deliveryCharge}`}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{currency}{tax}</span>
                </div>
              </div>

              <div className="flex justify-between mb-6 text-lg font-bold">
                <span>Total</span>
                <span className="text-green-600">{currency}{displayAmount.toFixed(2)}</span>
              </div>

              <Link
                to="/cart"
                className="block text-center text-green-600 hover:text-green-700 font-bold"
              >
                ← Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
