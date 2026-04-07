export const FREE_SHIPPING_THRESHOLD = 100;
export const SHIPPING_FEE = 50;
export const TAX_RATE = 0.02;

const roundToTwo = (value) => Number(Number(value).toFixed(2));

export const calculateTotals = (subtotal) => {
  const safeSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : 0;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - safeSubtotal);
  const deliveryCharge = safeSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const shippingProgress = Math.min(100, (safeSubtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const tax = roundToTwo(safeSubtotal * TAX_RATE);
  const totalAmount = roundToTwo(safeSubtotal + deliveryCharge + tax);

  return {
    subtotal: roundToTwo(safeSubtotal),
    amountToFreeShipping: roundToTwo(amountToFreeShipping),
    deliveryCharge,
    shippingProgress,
    tax,
    totalAmount,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  };
};