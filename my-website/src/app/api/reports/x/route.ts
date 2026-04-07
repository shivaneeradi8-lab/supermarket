import { NextRequest, NextResponse } from 'next/server';
import { requireSellerOrAdmin } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import Product from '@/models/Product';
import StockLog from '@/models/StockLog';

type ProductStockSnapshot = {
  _id: unknown;
  name?: string;
  category?: string;
  currentStock?: number;
  stock?: number;
};

type StockLogEntry = {
  productId: unknown;
  quantity?: number;
  type: 'add' | 'sale';
};

function getDayWindow(dateString: string | null) {
  const base = dateString ? new Date(dateString) : new Date();
  const validBase = Number.isNaN(base.getTime()) ? new Date() : base;

  const start = new Date(validBase);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

// GET /api/reports/x - Daily X-report showing stock sold vs stock added
export async function GET(request: NextRequest) {
  try {
    const { response } = requireSellerOrAdmin(request);
    if (response) {
      return response;
    }

    await connectToDatabase();

    const reportDate = request.nextUrl.searchParams.get('date');
    const { start, end } = getDayWindow(reportDate);

    const [entries, products] = await Promise.all([
      StockLog.find({
        type: { $in: ['add', 'sale'] },
        date: { $gte: start, $lt: end }
      })
        .lean(),
      Product.find({}, 'name category currentStock stock').lean()
    ]);

    const productsById = new Map(
      (products as ProductStockSnapshot[]).map((product) => [String(product._id), product])
    );

    const productSummaryMap = new Map<string, {
      productId: string;
      productName: string;
      category: string;
      sold: number;
      added: number;
      net: number;
    }>();

    let totalSold = 0;
    let totalAdded = 0;

    for (const entry of entries as StockLogEntry[]) {
      const productId = String(entry.productId);
      const quantity = Number(entry.quantity) || 0;
      const product = productsById.get(productId);

      if (!productSummaryMap.has(productId)) {
        productSummaryMap.set(productId, {
          productId,
          productName: product?.name || 'Unknown Product',
          category: product?.category || 'Unknown',
          sold: 0,
          added: 0,
          net: 0
        });
      }

      const summary = productSummaryMap.get(productId)!;
      if (entry.type === 'sale') {
        summary.sold += quantity;
        totalSold += quantity;
      }

      if (entry.type === 'add') {
        summary.added += quantity;
        totalAdded += quantity;
      }

      summary.net = summary.added - summary.sold;
    }

    const productsSummary = Array.from(productSummaryMap.values()).sort((a, b) => b.sold - a.sold);

    const totals = {
      sold: totalSold,
      added: totalAdded,
      net: totalAdded - totalSold,
      closingCurrentStock: (products as ProductStockSnapshot[]).reduce(
        (acc, product) => acc + (Number(product.currentStock) || 0),
        0
      ),
      closingAvailableStock: (products as ProductStockSnapshot[]).reduce(
        (acc, product) => acc + (Number(product.stock) || 0),
        0
      )
    };

    return NextResponse.json({
      success: true,
      data: {
        date: start.toISOString().slice(0, 10),
        range: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        totals,
        products: productsSummary
      }
    });
  } catch (error) {
    console.error('Error generating X-report:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate daily X-report' },
      { status: 500 }
    );
  }
}
