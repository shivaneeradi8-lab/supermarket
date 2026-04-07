import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  total: {
    type: Number,
    required: true
  }
});

const ShippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String
  },
  phone: {
    type: String
  },
  street: {
    type: String,
    required: [true, 'Street address is required']
  },
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String
  },
  zipCode: {
    type: String,
    required: [true, 'ZIP code is required']
  },
  country: {
    type: String,
    default: 'India'
  }
});

const DeliveryLocationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    min: [-90, 'Latitude cannot be less than -90'],
    max: [90, 'Latitude cannot be more than 90']
  },
  longitude: {
    type: Number,
    min: [-180, 'Longitude cannot be less than -180'],
    max: [180, 'Longitude cannot be more than 180']
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [OrderItemSchema],
  shippingAddress: ShippingAddressSchema,
  paymentMethod: {
    type: String,
    required: [true, 'Payment method is required'],
    enum: ['stripe', 'paypal', 'cod', 'upi']
  },
  paymentResult: {
    id: String,
    status: String,
    email_address: String,
    provider: String,
    reason: String,
    webhookEventId: String,
    receivedAt: Date
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  totalPrice: {
    type: Number,
    required: true
  },
  isPaid: {
    type: Boolean,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  deliveryNotes: {
    type: String,
    maxlength: [500, 'Delivery notes cannot exceed 500 characters']
  },
  estimatedDelivery: {
    type: Date
  },
  deliveryTracking: {
    currentLocation: DeliveryLocationSchema,
    etaMinutes: Number,
    courierName: String,
    statusNote: String
  },
  pendingExpiresAt: {
    type: Date,
    index: true
  },
  clientRequestId: {
    type: String,
    trim: true,
    maxlength: [128, 'Client request id cannot exceed 128 characters']
  },
  orderFingerprint: {
    type: String,
    trim: true,
    maxlength: [128, 'Order fingerprint cannot exceed 128 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
OrderSchema.index({ user: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ isPaid: 1 });
OrderSchema.index(
  { user: 1, clientRequestId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      clientRequestId: { $exists: true, $type: 'string', $ne: '' }
    }
  }
);
OrderSchema.index(
  { user: 1, orderFingerprint: 1, status: 1, isPaid: 1 },
  {
    unique: true,
    partialFilterExpression: {
      orderFingerprint: { $exists: true, $type: 'string', $ne: '' },
      status: 'pending',
      isPaid: false
    }
  }
);

// Virtual for order number
OrderSchema.virtual('orderNumber').get(function() {
  return `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
});

// Ensure virtual fields are serialized
OrderSchema.set('toJSON', { virtuals: true });
OrderSchema.set('toObject', { virtuals: true });

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);