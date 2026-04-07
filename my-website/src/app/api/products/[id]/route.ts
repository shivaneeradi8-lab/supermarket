import { NextRequest, NextResponse } from 'next/server';
import { requireSellerOrAdmin } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Product from '@/models/Product';
import StockLog from '@/models/StockLog';

// GET /api/products/[id] - Fetch single product
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();

    const { id } = await params;
    const product = await Product.findById(id).lean();

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

// PUT /api/products/[id] - Update product (Seller or Admin)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = requireSellerOrAdmin(request);
    if (response) {
      return response;
    }

    await connectToDatabase();


    const { id } = await params;
    const body = await request.json();
    const updateData = { ...body };

    // Remove fields that shouldn't be updated directly
    delete updateData._id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.effectivePrice;
    delete updateData.discountedPrice;

    // If newStock is provided, add it to the current stock
    if (typeof updateData.newStock === 'number') {
      const product = await Product.findById(id);
      if (!product) {
        return NextResponse.json(
          { success: false, message: 'Product not found' },
          { status: 404 }
        );
      }

      const delta = Number(updateData.newStock);
      if (!Number.isFinite(delta) || delta <= 0) {
        return NextResponse.json(
          { success: false, message: 'newStock must be a positive number' },
          { status: 400 }
        );
      }

      const beforeStock = Number(product.currentStock ?? product.stock) || 0;
      product.currentStock = beforeStock + delta;
      product.stock = (Number(product.stock) || 0) + delta;
      await product.save();

      await StockLog.create({
        productId: product._id,
        type: 'add',
        quantity: delta,
        beforeStock,
        afterStock: Number(product.currentStock) || 0,
        source: 'manual',
        note: 'Manual stock replenishment'
      });

      return NextResponse.json({ success: true, data: product.toObject() });
    }

    if (typeof updateData.salePrice !== 'undefined') {
      const parsedSalePrice = Number(updateData.salePrice);
      if (!Number.isFinite(parsedSalePrice) || parsedSalePrice < 0) {
        return NextResponse.json(
          { success: false, message: 'salePrice must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.salePrice = parsedSalePrice;
    }

    if (typeof updateData.isSaleActive !== 'undefined') {
      updateData.isSaleActive = Boolean(updateData.isSaleActive);
      if (updateData.isSaleActive && typeof updateData.salePrice === 'undefined') {
        const existingProduct = await Product.findById(id).lean();
        if (!existingProduct || typeof existingProduct.salePrice !== 'number') {
          return NextResponse.json(
            { success: false, message: 'salePrice is required when enabling sale mode' },
            { status: 400 }
          );
        }
      }
    }

    if (typeof updateData.currentStock !== 'undefined') {
      const parsedCurrentStock = Number(updateData.currentStock);
      if (!Number.isFinite(parsedCurrentStock) || parsedCurrentStock < 0) {
        return NextResponse.json(
          { success: false, message: 'currentStock must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.currentStock = Math.floor(parsedCurrentStock);
    }

    if (typeof updateData.stock !== 'undefined') {
      const parsedAvailableStock = Number(updateData.stock);
      if (!Number.isFinite(parsedAvailableStock) || parsedAvailableStock < 0) {
        return NextResponse.json(
          { success: false, message: 'stock must be a non-negative number' },
          { status: 400 }
        );
      }
      updateData.stock = Math.floor(parsedAvailableStock);
    }

    if (typeof updateData.currentStock === 'number' && typeof updateData.stock === 'number' && updateData.stock > updateData.currentStock) {
      return NextResponse.json(
        { success: false, message: 'Available stock cannot exceed current stock' },
        { status: 400 }
      );
    }

    // Otherwise, update as usual
    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).lean();

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: product
    });

  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id] - Delete product (Seller or Admin)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { response } = requireSellerOrAdmin(request);
    if (response) {
      return response;
    }

    await connectToDatabase();

    const { id } = await params;
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete product' },
      { status: 500 }
    );
  }
}