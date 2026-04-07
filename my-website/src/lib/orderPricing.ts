type ProductLike = {
  _id: unknown;
  name: string;
  image: string;
  price: number;
  salePrice?: number;
  isSaleActive?: boolean;
  effectivePrice?: number;
};

type OrderItemInput = {
  product: string;
  quantity: number;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export function calculateOrderPricing(
  products: ProductLike[],
  orderItems: OrderItemInput[]
) {
  let itemsPrice = 0;

  const orderItemsWithDetails = orderItems.map((item, index) => {
    const product = products[index];
    const quantity = Number(item.quantity);
    const basePrice =
      typeof product.effectivePrice === 'number'
        ? Number(product.effectivePrice)
        : product.isSaleActive && typeof product.salePrice === 'number'
        ? Number(product.salePrice)
        : Number(product.price);
    const itemTotal = roundCurrency(basePrice * quantity);

    itemsPrice += itemTotal;

    return {
      product: product._id,
      name: product.name,
      image: product.image,
      price: roundCurrency(basePrice),
      quantity,
      total: itemTotal,
    };
  });

  const roundedItemsPrice = roundCurrency(itemsPrice);
  const taxPrice = roundCurrency(roundedItemsPrice * 0.08);
  const shippingPrice = roundedItemsPrice > 50 ? 0 : 4.99;
  const totalPrice = roundCurrency(roundedItemsPrice + taxPrice + shippingPrice);

  return {
    orderItemsWithDetails,
    itemsPrice: roundedItemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  };
}