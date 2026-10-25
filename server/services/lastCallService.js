/**
 * Last Call Deals Service
 * Evaluates slow-moving inventory toward the end of the day and applies controlled discounts.
 * 
 * Safety Rules Enforced:
 * 1. Never creates new inventory records.
 * 2. References existing products without modifying database records.
 * 3. Prevents excessive or repeated discounts (strictly clamps between minDiscount and maxDiscount).
 * 4. Strictly excludes sold-out products (stock <= 0).
 * 5. Strictly excludes administrator-selected products.
 * 6. Strictly excludes products that already have high daily sales.
 */

const DEFAULT_LAST_CALL_SETTINGS = {
  enabled: true,
  startTime: '18:00', // 6:00 PM
  endTime: '23:59',   // Store close
  minStock: 5,        // Must have at least 5 units in stock
  minDiscount: 15,    // 15% minimum discount
  maxDiscount: 35,    // 35% maximum discount
  defaultDiscount: 20,// 20% baseline
  maxDailySales: 2,   // Sold 2 or fewer units today to qualify as slow-moving
  excludedProductIds: [18], // e.g. Competitor's Best Seller or premium specials
  manualOverride: 'auto', // 'auto' | 'force_on' | 'force_off' (allows admin to test anytime)
};

export function getLastCallSettings(db) {
  try {
    const row = db.prepare('SELECT value FROM notification_settings WHERE key = ?').get('last_call_settings');
    if (!row) {
      db.prepare('INSERT INTO notification_settings (key, value) VALUES (?, ?)').run(
        'last_call_settings',
        JSON.stringify(DEFAULT_LAST_CALL_SETTINGS)
      );
      return { ...DEFAULT_LAST_CALL_SETTINGS };
    }
    const parsed = JSON.parse(row.value);
    return { ...DEFAULT_LAST_CALL_SETTINGS, ...parsed };
  } catch (_e) {
    return { ...DEFAULT_LAST_CALL_SETTINGS };
  }
}

export function updateLastCallSettings(db, updates = {}) {
  const current = getLastCallSettings(db);

  const clean = {
    enabled: updates.enabled !== undefined ? Boolean(updates.enabled) : current.enabled,
    startTime: typeof updates.startTime === 'string' && /^\d{2}:\d{2}$/.test(updates.startTime)
      ? updates.startTime
      : current.startTime,
    endTime: typeof updates.endTime === 'string' && /^\d{2}:\d{2}$/.test(updates.endTime)
      ? updates.endTime
      : current.endTime,
    minStock: Number.isInteger(Number(updates.minStock)) && Number(updates.minStock) >= 0
      ? Number(updates.minStock)
      : current.minStock,
    minDiscount: Number(updates.minDiscount) >= 5 && Number(updates.minDiscount) <= 90
      ? Number(updates.minDiscount)
      : current.minDiscount,
    maxDiscount: Number(updates.maxDiscount) >= 5 && Number(updates.maxDiscount) <= 90
      ? Number(updates.maxDiscount)
      : current.maxDiscount,
    defaultDiscount: Number(updates.defaultDiscount) >= 5 && Number(updates.defaultDiscount) <= 90
      ? Number(updates.defaultDiscount)
      : current.defaultDiscount,
    maxDailySales: Number.isInteger(Number(updates.maxDailySales)) && Number(updates.maxDailySales) >= 0
      ? Number(updates.maxDailySales)
      : current.maxDailySales,
    excludedProductIds: Array.isArray(updates.excludedProductIds)
      ? updates.excludedProductIds.map(Number).filter((n) => Number.isInteger(n))
      : current.excludedProductIds,
    manualOverride: ['auto', 'force_on', 'force_off'].includes(updates.manualOverride)
      ? updates.manualOverride
      : current.manualOverride,
  };

  // Ensure minDiscount <= maxDiscount
  if (clean.minDiscount > clean.maxDiscount) {
    clean.maxDiscount = clean.minDiscount;
  }

  db.prepare(`
    INSERT INTO notification_settings (key, value, updated_at) 
    VALUES ('last_call_settings', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(clean));

  return clean;
}

export function isLastCallWindowActive(settings, currentTime = new Date()) {
  if (!settings.enabled) {
    return {
      active: false,
      reason: 'Feature disabled by administrator',
      mode: 'disabled',
      startTime: settings.startTime,
      endTime: settings.endTime,
    };
  }

  if (settings.manualOverride === 'force_on') {
    return {
      active: true,
      reason: 'Active (Testing / Admin Override)',
      mode: 'forced',
      startTime: settings.startTime,
      endTime: settings.endTime,
    };
  }

  if (settings.manualOverride === 'force_off') {
    return {
      active: false,
      reason: 'Disabled by Admin Override',
      mode: 'disabled',
      startTime: settings.startTime,
      endTime: settings.endTime,
    };
  }

  // Normal schedule: Check current local time (HH:MM)
  const pad = (n) => String(n).padStart(2, '0');
  const currentHM = `${pad(currentTime.getHours())}:${pad(currentTime.getMinutes())}`;

  const startHM = settings.startTime;
  const endHM = settings.endTime;

  let inWindow = false;
  if (startHM <= endHM) {
    inWindow = currentHM >= startHM && currentHM <= endHM;
  } else {
    // Overnight window (e.g. 20:00 to 02:00)
    inWindow = currentHM >= startHM || currentHM <= endHM;
  }

  return {
    active: inWindow,
    reason: inWindow
      ? `Evening Last Call Active (${settings.startTime} - ${settings.endTime})`
      : `Outside evening period (Scheduled for ${settings.startTime})`,
    mode: 'scheduled',
    currentHM,
    startTime: settings.startTime,
    endTime: settings.endTime,
  };
}

/**
 * Analyze slow-moving products and calculate controlled discounts
 */
export function evaluateLastCallDeals(db, explicitSettings = null, refDate = new Date()) {
  const settings = explicitSettings || getLastCallSettings(db);
  const windowStatus = isLastCallWindowActive(settings, refDate);

  const pad = (n) => String(n).padStart(2, '0');
  const todayYMD = `${refDate.getFullYear()}-${pad(refDate.getMonth() + 1)}-${pad(refDate.getDate())}`;

  // Read all existing products
  const products = db.prepare(`
    SELECT * FROM products 
    WHERE availability = 1
    ORDER BY name ASC
  `).all();

  const dailySalesStmt = db.prepare(`
    SELECT COALESCE(SUM(oi.quantity), 0) AS units_sold
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = ?
      AND o.order_status != 'Cancelled'
      AND (
        date(o.created_at) = ?
        OR o.created_at LIKE ?
      )
  `);

  const evaluated = [];
  const activeDeals = [];

  for (const prod of products) {
    const originalPrice = Number(prod.price);
    const stock = Number(prod.stock_quantity);

    // Sales check for today
    const salesResult = dailySalesStmt.get(prod.id, todayYMD, `${todayYMD}%`);
    const todaySales = Number(salesResult?.units_sold || 0);

    const isExcluded = settings.excludedProductIds.includes(prod.id);
    const isSoldOut = stock <= 0;
    const isLowStockForDeal = stock < settings.minStock;
    const isFastMoving = todaySales > settings.maxDailySales;

    let isEligible = false;
    let ineligibleReason = null;

    if (isSoldOut) {
      ineligibleReason = 'Sold out';
    } else if (isExcluded) {
      ineligibleReason = 'Excluded by administrator';
    } else if (isLowStockForDeal) {
      ineligibleReason = `Stock (${stock}) below minimum required (${settings.minStock})`;
    } else if (isFastMoving) {
      ineligibleReason = `High sales today (${todaySales} units sold)`;
    } else {
      isEligible = true;
    }

    // Controlled discount calculation
    // Clamped strictly between minDiscount and maxDiscount
    let discountPercentage = 0;
    let discountedPrice = originalPrice;
    let savings = 0;

    if (isEligible) {
      // Progressive formula: give a slightly bigger discount for products with higher remaining stock
      const surplusStock = Math.max(0, stock - settings.minStock);
      const stockBonus = Math.floor(surplusStock * 1.5);
      const calculatedPct = Math.min(
        settings.maxDiscount,
        Math.max(settings.minDiscount, settings.minDiscount + stockBonus)
      );

      discountPercentage = calculatedPct;
      discountedPrice = Number((originalPrice * (1 - discountPercentage / 100)).toFixed(2));
      savings = Number((originalPrice - discountedPrice).toFixed(2));
    }

    let status = 'Not Eligible';
    if (isEligible) {
      if (windowStatus.active) {
        status = 'Active Deal';
      } else {
        status = `Eligible (Starts at ${settings.startTime})`;
      }
    } else {
      status = ineligibleReason;
    }

    const itemData = {
      productId: prod.id,
      productName: prod.name,
      description: prod.description,
      image: prod.image,
      stockQuantity: stock,
      originalPrice,
      discountPercentage: isEligible ? discountPercentage : 0,
      discountedPrice: isEligible ? discountedPrice : originalPrice,
      savings: isEligible ? savings : 0,
      todaySales,
      isEligible,
      ineligibleReason,
      isDealActive: isEligible && windowStatus.active,
      status,
    };

    evaluated.push(itemData);

    if (isEligible && windowStatus.active) {
      activeDeals.push(itemData);
    }
  }

  return {
    windowStatus,
    settings,
    todayDate: todayYMD,
    activeDealCount: activeDeals.length,
    eligibleCount: evaluated.filter((e) => e.isEligible).length,
    activeDeals,
    allProducts: evaluated,
  };
}

/**
 * Return Map of active deals: productId -> { discount_percentage, discounted_price, original_price }
 */
export function getActiveDealsMap(db, refDate = new Date()) {
  const result = evaluateLastCallDeals(db, null, refDate);
  const map = new Map();

  if (result.windowStatus.active) {
    for (const deal of result.activeDeals) {
      map.set(deal.productId, {
        discount_percentage: deal.discountPercentage,
        discounted_price: deal.discountedPrice,
        original_price: deal.originalPrice,
        status: deal.status,
      });
    }
  }

  return map;
}
