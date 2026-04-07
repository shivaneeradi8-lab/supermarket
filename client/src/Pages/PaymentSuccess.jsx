import React from "react";
import { Link, useLocation } from "react-router-dom";

const LAST_PAID_ORDER_STORAGE_KEY = "greencart_last_paid_order";

const readStoredPayment = () => {
  try {
    const raw = sessionStorage.getItem(LAST_PAID_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const playSuccessTone = () => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.0001, now + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.14, now + index * 0.12 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + index * 0.12);
    osc.stop(now + index * 0.12 + 0.24);
  });

  window.setTimeout(() => {
    void ctx.close();
  }, 1200);
};

const PaymentSuccess = () => {
  const location = useLocation();
  const stateOrder = location.state && typeof location.state === "object" ? location.state : null;
  const storedOrder = readStoredPayment();
  const order = stateOrder || storedOrder;

  React.useEffect(() => {
    playSuccessTone();
  }, []);

  const amount = Number(order?.amount || 0);
  const paidDate = order?.paidAt ? new Date(order.paidAt) : new Date();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-100 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl animate-[fadeIn_600ms_ease-out] rounded-3xl bg-white/90 p-8 shadow-[0_20px_70px_rgba(16,185,129,0.18)] backdrop-blur sm:p-10">
        <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px);} to { opacity: 1; transform: translateY(0);} } @keyframes popCheck { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }`}</style>

        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/10">
            <svg
              viewBox="0 0 52 52"
              className="h-16 w-16 animate-[popCheck_700ms_ease-out]"
              aria-hidden="true"
            >
              <circle cx="26" cy="26" r="25" fill="#10B981" opacity="0.18" />
              <path
                fill="none"
                stroke="#10B981"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 27l8 8 16-18"
              />
            </svg>
          </div>

          <p className="rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Payment Successful
          </p>
          <h1 className="mt-4 text-3xl font-bold text-emerald-800 sm:text-4xl">Order Placed Successfully</h1>
          <p className="mt-3 max-w-xl text-sm text-emerald-900/70 sm:text-base">
            Your transaction is confirmed through the payment gateway and verified by our order workflow.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700/80">Order ID</p>
              <p className="mt-1 font-semibold text-emerald-900">{order?.orderId || "Not available"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700/80">Amount</p>
              <p className="mt-1 font-semibold text-emerald-900">INR {amount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-700/80">Date</p>
              <p className="mt-1 font-semibold text-emerald-900">{paidDate.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/my-orders"
            className="rounded-full bg-emerald-600 px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            View Orders
          </Link>
          <Link
            to="/products"
            className="rounded-full border border-emerald-300 bg-white px-6 py-3 text-center text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
