import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: ['Fruits', 'Vegetables', 'Dairy', 'Meat', 'Bakery', 'Beverages', 'Pantry', 'Snacks', 'Household']
  },
  image: {
    type: String,
    required: [true, 'Product image is required']
  },
  stock: {
    type: Number,
    required: [true, 'Available stock quantity is required'],
    min: [0, 'Available stock cannot be negative'],
    default: 0
  },
  currentStock: {
    type: Number,
    required: [true, 'Current stock quantity is required'],
    min: [0, 'Current stock cannot be negative'],
    default: 0
  },
  rating: {
    type: Number,
    min: [0, 'Rating cannot be less than 0'],
    max: [5, 'Rating cannot be more than 5'],
    default: 0
  },
  numReviews: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  discount: {
    type: Number,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%'],
    default: 0
  },
  salePrice: {
    type: Number,
    min: [0, 'Sale price cannot be negative']
  },
  isSaleActive: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  weight: {
    type: String,
    trim: true
  },
  unit: {
    type: String,
    enum: ['kg', 'g', 'L', 'ml', 'pcs', 'pack'],
    default: 'pcs'
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    maxlength: [64, 'Barcode cannot exceed 64 characters']
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
ProductSchema.index({ category: 1 });
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });

// Virtual for discounted price
ProductSchema.virtual('discountedPrice').get(function() {
  if (this.discount > 0) {
    return this.price * (1 - this.discount / 100);
  }
  return this.price;
});

ProductSchema.virtual('effectivePrice').get(function() {
  if (this.isSaleActive && typeof this.salePrice === 'number') {
    return this.salePrice;
  }

  if (this.discount > 0) {
    return this.price * (1 - this.discount / 100);
  }

  return this.price;
});

ProductSchema.pre('save', function() {
  if (typeof this.currentStock !== 'number') {
    this.currentStock = Number(this.stock) || 0;
  }

  if (this.currentStock < this.stock) {
    this.currentStock = this.stock;
  }
});

// Ensure virtual fields are serialized
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);