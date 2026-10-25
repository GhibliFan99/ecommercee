/**
 * Analytics Service for Best Seller Chart & Reporting
 * Reads directly from existing products, orders, and order_items tables.
 * Safe & Read-Only: NEVER modifies or duplicates inventory or sales records.
 */

export function getBestSellers(db, options = {}) {
  const {
    period = 'all', // 'today', 'week', 'month', 'all', 'custom'
    startDate = null,
    endDate = null,
    limit = 20,
  } = options;

  // 1. Determine date boundaries
  const now = new Date();
  let filterStart = null;
  let filterEnd = null;

  const pad = (n) => String(n).padStart(2, '0');
  const formatYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === 'today') {
    const todayStr = formatYMD(now);
    filterStart = `${todayStr} 00:00:00`;
    filterEnd = `${todayStr} 23:59:59`;
  } else if (period === 'week') {
    // Rolling 7 days (last 7 days)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    filterStart = `${formatYMD(sevenDaysAgo)} 00:00:00`;
    filterEnd = `${formatYMD(now)} 23:59:59`;
  } else if (period === 'month') {
    // 1st of current month
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filterStart = `${formatYMD(firstOfMonth)} 00:00:00`;
    filterEnd = `${formatYMD(now)} 23:59:59`;
  } else if (period === 'custom') {
    if (startDate) {
      filterStart = `${startDate.trim()} 00:00:00`;
    }
    if (endDate) {
      filterEnd = `${endDate.trim()} 23:59:59`;
    }
  }

  // 2. Build SQL query with safe parameters
  let dateCondition = '';
  const params = [];

  if (filterStart && filterEnd) {
    dateCondition = "AND datetime(o.created_at, 'localtime') >= ? AND datetime(o.created_at, 'localtime') <= ?";
    params.push(filterStart, filterEnd);
  } else if (filterStart) {
    dateCondition = "AND datetime(o.created_at, 'localtime') >= ?";
    params.push(filterStart);
  } else if (filterEnd) {
    dateCondition = "AND datetime(o.created_at, 'localtime') <= ?";
    params.push(filterEnd);
  }

  const query = `
    SELECT 
      p.id AS product_id,
      p.name AS product_name,
      p.description AS product_description,
      p.price AS current_price,
      p.image,
      p.stock_quantity AS current_stock,
      p.availability,
      COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS units_sold,
      COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.subtotal ELSE 0 END), 0) AS sales_revenue,
      COUNT(DISTINCT o.id) AS order_count,
      (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE product_id = p.id) AS all_time_units
    FROM products p
    LEFT JOIN order_items oi ON p.id = oi.product_id
    LEFT JOIN orders o ON oi.order_id = o.id 
      AND o.order_status != 'Cancelled'
      ${dateCondition}
    WHERE p.availability = 1
    GROUP BY p.id
    ORDER BY units_sold DESC, sales_revenue DESC, all_time_units DESC
    LIMIT ?
  `;

  params.push(Math.max(1, Math.min(Number(limit) || 20, 100)));

  const rows = db.prepare(query).all(...params);

  // 3. Compute totals and metrics
  const totalUnitsSold = rows.reduce((sum, r) => sum + Number(r.units_sold || 0), 0);
  const totalRevenue = rows.reduce((sum, r) => sum + Number(r.sales_revenue || 0), 0);

  const bestSellers = rows.map((r, index) => {
    const units = Number(r.units_sold || 0);
    const revenue = Number(Number(r.sales_revenue || 0).toFixed(2));
    const stock = Number(r.current_stock || 0);

    let stockStatus = 'healthy';
    if (stock <= 0) stockStatus = 'out_of_stock';
    else if (stock <= 5) stockStatus = 'low_stock';

    return {
      rank: index + 1,
      productId: r.product_id,
      productName: r.product_name,
      description: r.product_description,
      currentPrice: Number(r.current_price || 0),
      currentStock: stock,
      stockStatus,
      image: r.image,
      unitsSold: units,
      salesRevenue: revenue,
      orderCount: Number(r.order_count || 0),
      percentageOfUnits: totalUnitsSold > 0 ? Number(((units / totalUnitsSold) * 100).toFixed(1)) : 0,
      percentageOfRevenue: totalRevenue > 0 ? Number(((revenue / totalRevenue) * 100).toFixed(1)) : 0,
    };
  });

  return {
    period,
    startDate: filterStart,
    endDate: filterEnd,
    summary: {
      totalUnitsSold,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      productCount: rows.length,
      topSeller: bestSellers[0] || null,
    },
    bestSellers,
  };
}
