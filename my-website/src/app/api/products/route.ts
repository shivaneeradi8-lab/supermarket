import { NextRequest, NextResponse } from 'next/server';
import { requireSellerOrAdmin } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Product from '@/models/Product';
import StockLog from '@/models/StockLog';

// GET /api/products - Fetch all products with optional filtering
export async function GET(request: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';

  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build query
    const query: {
      isActive: boolean;
      seller?: string;
      category?: string;
      $text?: { $search: string };
    } = { isActive: true };

    // Seller filtering
    const seller = searchParams.get('seller');
    if (seller) {
      query.seller = seller;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort: Record<string, 1 | -1> = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: products,
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    if (isDev) {
      // MongoDB unavailable in dev — return empty list so the client falls back to dummy data cleanly.
      console.warn('[DEV] MongoDB unavailable. Returning empty products list.');
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { currentPage: 1, totalPages: 0, totalProducts: 0, hasNextPage: false, hasPrevPage: false }
      });
    }
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST /api/products - Create a new product (Seller or Admin)
export async function POST(request: NextRequest) {
  try {
    const { response } = requireSellerOrAdmin(request);
    if (response) {
      return response;
    }

    await connectToDatabase();

    const body = await request.json();
    const {
      name,
      description,
      price,
      originalPrice,
      category,
      image,
      stock,
      currentStock,
      discount,
      salePrice,
      isSaleActive,
      tags,
      weight,
      unit
    } = body;

    // Validate required fields
    if (!name || !price || !category || !image) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedAvailableStock = Number(stock || 0);
    const parsedCurrentStock = Number(currentStock ?? parsedAvailableStock);

    // Create new product
    const product = new Product({
      name,
      description,
      price,
      originalPrice,
      category,
      image,
      stock: Math.max(0, Math.floor(parsedAvailableStock)),
      currentStock: Math.max(0, Math.floor(parsedCurrentStock)),
      discount: discount || 0,
      salePrice,
      isSaleActive: Boolean(isSaleActive),
      tags: tags || [],
      weight,
      unit: unit || 'pcs'
    });

    if (product.currentStock < product.stock) {
      product.currentStock = product.stock;
    }

    const savedProduct = await product.save();

    if (Number(savedProduct.currentStock) > 0) {
      await StockLog.create({
        productId: savedProduct._id,
        type: 'add',
        quantity: Number(savedProduct.currentStock),
        beforeStock: 0,
        afterStock: Number(savedProduct.currentStock),
        source: 'manual',
        note: 'Initial stock added during product creation'
      });
    }

    return NextResponse.json({
      success: true,
      data: savedProduct
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create product' },
      { status: 500 }
    );
  }
}