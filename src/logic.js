import { parseMoney, roundMoney } from './format.js';

const CURRENCIES = ['MRU', 'EUR', 'MAD', 'TND', 'DA'];
const REASONS = ['tester', 'gift', 'loss', 'inventory', 'other'];
export const PORTION_ML = 10;

export function canPortion(product) {
  return product?.volumeMl === 100 || product?.volumeMl === 200;
}

export function portionPrice(product, currency) {
  if (!canPortion(product)) return 0;
  return roundMoney(Number(product.portionSell) || 0, currency);
}

export function portionCost(product, currency) {
  if (!canPortion(product)) return 0;
  return roundMoney((product.buyPrice || 0) * PORTION_ML / product.volumeMl, currency);
}

export function maxPortions(product) {
  if (!canPortion(product)) return 0;
  const fromOpen = (product.openMl || []).reduce((sum, ml) => sum + Math.floor(Number(ml) / PORTION_ML), 0);
  return fromOpen + product.stock * (product.volumeMl / PORTION_ML);
}

function cleanOpen(value) {
  if (!Array.isArray(value)) return [];
  return value.map((ml) => Math.floor(Number(ml) || 0)).filter((ml) => ml > 0);
}

function takePortions(product, count) {
  const openMl = cleanOpen(product.openMl).sort((a, b) => a - b);
  let stock = product.stock;
  let left = count;
  while (left > 0) {
    const index = openMl.findIndex((ml) => ml >= PORTION_ML);
    if (index >= 0) {
      openMl[index] -= PORTION_ML;
      if (openMl[index] <= 0) openMl.splice(index, 1);
      left -= 1;
      continue;
    }
    if (stock < 1) return null;
    stock -= 1;
    const rest = product.volumeMl - PORTION_ML;
    if (rest > 0) openMl.push(rest);
    openMl.sort((a, b) => a - b);
    left -= 1;
  }
  return { stock, openMl };
}

export function uid() {
  return crypto.randomUUID();
}

export function initialState(lang = 'fr', currency = 'MRU') {
  return {
    v: 1,
    lang: lang === 'ar' ? 'ar' : 'fr',
    settings: { currency: CURRENCIES.includes(currency) ? currency : 'MRU' },
    products: [],
    sales: [],
    restocks: [],
    writeoffs: [],
    expenses: [],
    loans: [],
    shipments: [],
  };
}

export const EXPENSE_CATEGORIES = ['water', 'food', 'transport', 'packaging', 'other'];
export const REMIND_DAYS = 28;

function currencyOf(state) {
  return state.settings?.currency || 'MRU';
}

const IMAGE_PATH = /^\/(?:perfumes|api\/media)\/[a-zA-Z0-9._-]+$/;

function cleanImage(value) {
  const text = String(value || '').trim();
  return IMAGE_PATH.test(text) ? text : '';
}

function normalizeProduct(product) {
  return {
    id: String(product.id),
    nameFr: String(product.nameFr || ''),
    nameAr: String(product.nameAr || ''),
    brand: String(product.brand || ''),
    ref: String(product.ref || ''),
    concentration: product.concentration || 'edp',
    volumeMl: product.volumeMl == null || product.volumeMl === '' ? null : Number(product.volumeMl),
    gender: product.gender || 'mixed',
    buyPrice: Number(product.buyPrice) || 0,
    sellPrice: Number(product.sellPrice) || 0,
    portionSell: Math.max(0, Number(product.portionSell) || 0),
    stock: Math.max(0, Math.floor(Number(product.stock) || 0)),
    openMl: cleanOpen(product.openMl),
    minStock: Math.max(0, Math.floor(Number(product.minStock) || 0)),
    image: cleanImage(product.image),
    createdAt: product.createdAt || new Date().toISOString(),
  };
}

function normalizeSale(sale) {
  return {
    ...sale,
    status: sale.status === 'refunded' ? 'refunded' : 'paid',
    discount: Number(sale.discount) || 0,
    total: Number(sale.total) || 0,
    subtotal: Number(sale.subtotal) || 0,
    payment: sale.payment === 'card' ? 'card' : 'cash',
    client: sale.client || '',
    note: sale.note || '',
    items: sale.items,
  };
}

export function sanitize(data) {
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.products) || !Array.isArray(data.sales)) return null;
  return {
    v: 1,
    lang: data.lang === 'ar' ? 'ar' : 'fr',
    settings: {
      currency: CURRENCIES.includes(data.settings?.currency) ? data.settings.currency : 'MRU',
    },
    products: data.products.filter((product) => product && typeof product.id === 'string').map(normalizeProduct),
    sales: data.sales.filter((sale) => sale && typeof sale.id === 'string' && Array.isArray(sale.items)).map(normalizeSale),
    restocks: Array.isArray(data.restocks) ? data.restocks.filter((row) => row && row.id) : [],
    writeoffs: Array.isArray(data.writeoffs) ? data.writeoffs.filter((row) => row && row.id) : [],
    expenses: Array.isArray(data.expenses) ? data.expenses.filter((row) => row && row.id).map(normalizeExpense) : [],
    loans: Array.isArray(data.loans) ? data.loans.filter((row) => row && row.id).map(normalizeLoan) : [],
    shipments: Array.isArray(data.shipments) ? data.shipments.filter((row) => row && row.id).map(normalizeShipment) : [],
  };
}

function loanStatus(total, paid) {
  if (paid <= 0) return 'pending';
  if (paid >= total) return 'paid';
  return 'partial';
}

function normalizeExpense(row) {
  return {
    id: String(row.id),
    amount: Number(row.amount) || 0,
    description: String(row.description || ''),
    category: EXPENSE_CATEGORIES.includes(row.category) ? row.category : '',
    spentAt: row.spentAt || row.createdAt || new Date().toISOString(),
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function normalizeLoan(row) {
  const total = Number(row.total) || 0;
  const paid = Math.min(total, Math.max(0, Number(row.paid) || 0));
  return {
    id: String(row.id),
    client: String(row.client || ''),
    contact: String(row.contact || ''),
    items: Array.isArray(row.items) ? row.items : [],
    total,
    paid,
    dueAt: row.dueAt || row.createdAt || new Date().toISOString(),
    remindAt: row.remindAt || row.createdAt || new Date().toISOString(),
    status: loanStatus(total, paid),
    payments: Array.isArray(row.payments) ? row.payments : [],
    note: String(row.note || ''),
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function normalizeLine(line) {
  return {
    productId: String(line.productId || ''),
    nameFr: String(line.nameFr || ''),
    nameAr: String(line.nameAr || ''),
    brand: String(line.brand || ''),
    qty: Math.max(0, Math.floor(Number(line.qty) || 0)),
    unitCost: Number(line.unitCost) || 0,
    sellPrice: Number(line.sellPrice) || 0,
    volumeMl: Number(line.volumeMl) || 0,
    soldBottles: Math.max(0, Math.floor(Number(line.soldBottles) || 0)),
    soldPortions: Math.max(0, Math.floor(Number(line.soldPortions) || 0)),
    openedBottles: Math.max(0, Math.floor(Number(line.openedBottles) || 0)),
    goneBottles: Math.max(0, Math.floor(Number(line.goneBottles) || 0)),
    openMl: Math.max(0, Math.floor(Number(line.openMl) || 0)),
    revenue: Number(line.revenue) || 0,
  };
}

function normalizeShipment(row) {
  const lines = (Array.isArray(row.lines) ? row.lines : []).map(normalizeLine);
  const perfumeCost = Number(row.perfumeCost) || lines.reduce((sum, line) => sum + Number(line.unitCost || 0) * Number(line.qty || 0), 0);
  const total = Number(row.total) || 0;
  return {
    id: String(row.id),
    total,
    perfumeCost,
    extraCost: Number(row.extraCost ?? (total - perfumeCost)) || 0,
    lines,
    note: String(row.note || ''),
    arrivedAt: row.arrivedAt || row.createdAt || new Date().toISOString(),
    createdAt: row.createdAt || new Date().toISOString(),
  };
}

function productFields(input, currency) {
  const nameFr = String(input.nameFr || '').trim().slice(0, 80);
  const nameAr = String(input.nameAr || '').trim().slice(0, 80);
  const brand = String(input.brand || '').trim().slice(0, 60);
  const ref = String(input.ref || '').trim().slice(0, 40) || `A-${uid().slice(0, 6).toUpperCase()}`;
  const image = cleanImage(input.image);
  if (!nameFr || !nameAr) return { error: 'required_name' };
  if (!brand || !image) return { error: 'required_fields' };

  const sellPrice = roundMoney(parseMoney(input.sellPrice), currency);
  const buyPrice = roundMoney(parseMoney(input.buyPrice), currency);
  if (!(sellPrice > 0) || !(buyPrice > 0)) return { error: 'need_price' };

  const volume = Number(String(input.volumeMl ?? '').replace(',', '.'));
  if (!Number.isFinite(volume) || volume <= 0) return { error: 'required_fields' };
  const volumeMl = Math.round(volume);

  if (input.minStock === '' || input.minStock == null) return { error: 'required_fields' };
  const minStock = Math.max(0, Math.floor(Number(input.minStock) || 0));
  let portionSell = 0;
  if (volumeMl === 100 || volumeMl === 200) {
    portionSell = roundMoney(parseMoney(input.portionSell), currency);
    if (!(portionSell > 0)) return { error: 'need_price' };
  }
  return {
    fields: {
      nameFr,
      nameAr,
      brand,
      ref,
      concentration: input.concentration || 'edp',
      volumeMl,
      gender: input.gender || 'mixed',
      buyPrice,
      sellPrice,
      portionSell,
      minStock,
      image,
    },
  };
}

export function applyProduct(state, input) {
  const parsed = productFields(input, currencyOf(state));
  if (parsed.error) return parsed;

  if (input.id) {
    if (!state.products.some((product) => product.id === input.id)) return { error: 'product_required' };
    return {
      state: {
        ...state,
        products: state.products.map((product) => (product.id === input.id ? { ...product, ...parsed.fields } : product)),
      },
    };
  }

  if (input.stock === '' || input.stock == null) return { error: 'required_fields' };
  const qty = Math.floor(Number(input.stock) || 0);
  if (!Number.isFinite(qty) || qty < 0) return { error: 'bad_qty' };

  const now = new Date().toISOString();
  const product = { id: uid(), ...parsed.fields, stock: qty, openMl: [], createdAt: now };
  const restocks = qty > 0
    ? [{
        id: uid(),
        productId: product.id,
        nameFr: product.nameFr,
        nameAr: product.nameAr,
        qty,
        unitCost: product.buyPrice > 0 ? product.buyPrice : null,
        noteKey: 'initial',
        note: '',
        createdAt: now,
      }, ...state.restocks]
    : state.restocks;

  return { state: { ...state, products: [product, ...state.products], restocks } };
}

export function applyDelete(state, id) {
  if (!id) return { error: 'product_required' };
  const currency = currencyOf(state);
  const sales = [];
  for (const sale of state.sales) {
    const items = sale.items.filter((item) => item.productId !== id);
    if (items.length === sale.items.length) {
      sales.push(sale);
      continue;
    }
    if (items.length === 0) continue;
    const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.qty), 0), currency);
    const discount = Math.min(roundMoney(Number(sale.discount) || 0, currency), subtotal);
    sales.push({
      ...sale,
      items,
      subtotal,
      discount,
      total: roundMoney(subtotal - discount, currency),
    });
  }
  const shipments = [];
  for (const shipment of state.shipments || []) {
    const lines = shipment.lines.filter((line) => line.productId !== id);
    if (lines.length === shipment.lines.length) {
      shipments.push(shipment);
      continue;
    }
    if (lines.length === 0) {
      shipments.push({
        ...shipment,
        lines: [],
        perfumeCost: 0,
        extraCost: roundMoney(Number(shipment.total) || 0, currency),
      });
      continue;
    }
    const perfumeCost = roundMoney(lines.reduce((sum, line) => sum + Number(line.unitCost) * Number(line.qty), 0), currency);
    shipments.push({
      ...shipment,
      lines,
      perfumeCost,
      extraCost: roundMoney(Number(shipment.total) - perfumeCost, currency),
    });
  }
  const loans = [];
  for (const loan of state.loans || []) {
    const items = loan.items.filter((item) => item.productId !== id);
    if (items.length === loan.items.length) {
      loans.push(loan);
      continue;
    }
    if (items.length === 0) continue;
    loans.push({ ...loan, items });
  }
  return {
    state: {
      ...state,
      products: state.products.filter((product) => product.id !== id),
      sales,
      restocks: state.restocks.filter((row) => row.productId !== id),
      writeoffs: state.writeoffs.filter((row) => row.productId !== id),
      shipments,
      loans,
    },
  };
}

export function applySale(state, payload) {
  const currency = currencyOf(state);
  const wanted = groupWanted(payload.lines);
  if (wanted.size === 0) return { error: 'sale_disabled' };

  const products = state.products.map((product) => ({ ...product, openMl: cleanOpen(product.openMl) }));
  const shipments = cloneShipments(state.shipments);
  const drawn = pullStock(products, shipments, wanted, currency);
  if (drawn.error) return drawn;
  const items = drawn.items;

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0), currency);
  const discount = roundMoney(parseMoney(payload.discount || 0), currency);
  if (discount < 0) return { error: 'bad_price' };
  if (discount > subtotal) return { error: 'discount_bad' };

  const client = String(payload.client || '').trim().slice(0, 80);
  if (!client) return { error: 'client_required' };

  const sale = {
    id: uid(),
    items,
    subtotal,
    discount,
    total: roundMoney(subtotal - discount, currency),
    payment: payload.payment === 'card' ? 'card' : 'cash',
    client,
    note: String(payload.note || '').trim().slice(0, 200),
    status: 'paid',
    createdAt: new Date().toISOString(),
  };
  shareMoney(items, sale.total, currency).forEach((money, index) => {
    creditRevenue(drawn.takes[index], money, items[index].qty, currency);
  });

  return { state: { ...state, products, shipments, sales: [sale, ...state.sales] }, sale };
}

export function applyRefund() {
  return { error: 'no_return' };
}

export function applyRestock(state, input) {
  const qty = Math.floor(Number(input.qty) || 0);
  if (!input.productId) return { error: 'product_required' };
  if (!Number.isFinite(qty) || qty < 1) return { error: 'bad_qty' };

  const products = state.products.map((product) => ({ ...product }));
  const product = products.find((item) => item.id === input.productId);
  if (!product) return { error: 'product_required' };

  if (input.unitCost === '' || input.unitCost == null) return { error: 'need_price' };
  const unitCost = roundMoney(parseMoney(input.unitCost), currencyOf(state));
  if (unitCost < 0) return { error: 'bad_price' };

  product.stock += qty;
  if (unitCost != null && unitCost > 0) product.buyPrice = unitCost;

  const movement = {
    id: uid(),
    productId: product.id,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    qty,
    unitCost: unitCost && unitCost > 0 ? unitCost : null,
    noteKey: '',
    note: String(input.note || '').trim().slice(0, 200),
    createdAt: new Date().toISOString(),
  };

  return { state: { ...state, products, restocks: [movement, ...state.restocks] } };
}

export function applyWriteoff(state, input) {
  const qty = Math.floor(Number(input.qty) || 0);
  if (!input.productId) return { error: 'product_required' };
  if (!Number.isFinite(qty) || qty < 1) return { error: 'bad_qty' };
  if (!REASONS.includes(input.reason)) return { error: 'reason_required' };

  const products = state.products.map((product) => ({ ...product, openMl: cleanOpen(product.openMl) }));
  const shipments = cloneShipments(state.shipments);
  const product = products.find((item) => item.id === input.productId);
  if (!product) return { error: 'product_required' };
  const consumed = consumeProduct(product, shipments, qty, 0, currencyOf(state), true);
  if (consumed.error) return consumed;

  const movement = {
    id: uid(),
    productId: product.id,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    qty,
    reason: input.reason,
    note: String(input.note || '').trim().slice(0, 200),
    createdAt: new Date().toISOString(),
  };

  return { state: { ...state, products, shipments, writeoffs: [movement, ...state.writeoffs] } };
}

export function activeSales(sales) {
  return sales.filter((sale) => sale.status !== 'refunded');
}

export function saleProfit(sale) {
  const gross = sale.items.reduce((sum, item) => sum + (Number(item.unitPrice) - Number(item.unitCost || 0)) * item.qty, 0);
  return gross - (Number(sale.discount) || 0);
}

export function sumRevenue(sales) {
  return activeSales(sales).reduce((sum, sale) => sum + Number(sale.total || 0), 0);
}

export function sumProfit(sales) {
  return activeSales(sales).reduce((sum, sale) => sum + saleProfit(sale), 0);
}

export function sumPurchases(restocks) {
  return restocks.reduce((sum, row) => sum + (row.unitCost ? Number(row.unitCost) * Number(row.qty) : 0), 0);
}

export function stockRetail(products) {
  return products.reduce((sum, product) => sum + product.stock * product.sellPrice, 0);
}

export function stockCost(products) {
  return products.reduce((sum, product) => sum + product.stock * (product.buyPrice || 0), 0);
}

export function stockUnits(products) {
  return products.reduce((sum, product) => sum + product.stock, 0);
}

export function isLow(product) {
  return product.stock <= product.minStock;
}

function parseWhen(value) {
  if (!value) return new Date();
  const text = String(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0)
    : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupWanted(lines) {
  const wanted = new Map();
  for (const line of lines || []) {
    const qty = Math.floor(Number(line.qty) || 0);
    if (qty < 1 || !line.productId) continue;
    const unit = line.unit === 'portion' ? 'portion' : 'bottle';
    const key = `${line.productId}:${unit}`;
    wanted.set(key, (wanted.get(key) || 0) + qty);
  }
  return wanted;
}

function cloneShipments(list) {
  return (list || []).map((shipment) => ({
    ...shipment,
    lines: (shipment.lines || []).map((line) => ({ ...normalizeLine(line) })),
  }));
}

function sealedOf(line) {
  return Math.max(0, Number(line.qty) - Number(line.soldBottles || 0) - Number(line.goneBottles || 0) - Number(line.openedBottles || 0));
}

function lotsOf(shipments, productId) {
  return [...(shipments || [])]
    .sort((a, b) => String(a.arrivedAt).localeCompare(String(b.arrivedAt)) || String(a.createdAt).localeCompare(String(b.createdAt)))
    .flatMap((shipment) => (shipment.lines || []).filter((line) => line.productId === productId));
}

function legacyOpenMl(product, lots) {
  const bag = cleanOpen(product.openMl);
  for (const line of lots) {
    const ml = Math.floor(Number(line.openMl) || 0);
    if (ml <= 0) continue;
    const index = bag.indexOf(ml);
    if (index >= 0) bag.splice(index, 1);
  }
  return bag;
}

function consumeProduct(product, shipments, bottles, portions, currency, loss = false) {
  const lots = lotsOf(shipments, product.id);
  if (bottles > product.stock) return { error: 'no_stock' };
  if (portions > 0) {
    if (!canPortion(product)) return { error: 'no_portion' };
    if (!(portionPrice(product, currency) > 0)) return { error: 'need_price' };
    const room = maxPortions({ ...product, stock: product.stock - bottles });
    if (portions > room) return { error: 'no_stock' };
  }

  const takes = [];
  const note = (line, kind, count) => {
    if (!line || count < 1) return;
    let row = takes.find((item) => item.line === line);
    if (!row) {
      row = { line, bottles: 0, portions: 0 };
      takes.push(row);
    }
    row[kind] += count;
  };

  let legacySealed = Math.max(0, product.stock - lots.reduce((sum, line) => sum + sealedOf(line), 0));
  let need = bottles;
  const fromLegacy = Math.min(need, legacySealed);
  legacySealed -= fromLegacy;
  need -= fromLegacy;
  for (const line of lots) {
    if (need <= 0) break;
    const take = Math.min(need, sealedOf(line));
    if (take <= 0) continue;
    if (loss) line.goneBottles += take;
    else line.soldBottles += take;
    note(line, 'bottles', take);
    need -= take;
  }
  if (need > 0) return { error: 'no_stock' };

  const opens = [];
  for (const ml of legacyOpenMl(product, lots)) opens.push({ ml, line: null });
  for (const line of lots) {
    if (line.openMl > 0) opens.push({ ml: line.openMl, line });
  }

  let left = portions;
  while (left > 0) {
    opens.sort((a, b) => a.ml - b.ml);
    const index = opens.findIndex((entry) => entry.ml >= PORTION_ML);
    if (index >= 0) {
      opens[index].ml -= PORTION_ML;
      if (opens[index].line) {
        opens[index].line.soldPortions += 1;
        opens[index].line.openMl = Math.max(0, opens[index].ml);
        note(opens[index].line, 'portions', 1);
      }
      if (opens[index].ml <= 0) opens.splice(index, 1);
      left -= 1;
      continue;
    }
    if (legacySealed > 0) {
      legacySealed -= 1;
      const rest = product.volumeMl - PORTION_ML;
      if (rest > 0) opens.push({ ml: rest, line: null });
      left -= 1;
      continue;
    }
    const line = lots.find((item) => sealedOf(item) > 0);
    if (!line) return { error: 'no_stock' };
    line.openedBottles += 1;
    line.soldPortions += 1;
    note(line, 'portions', 1);
    const rest = product.volumeMl - PORTION_ML;
    line.openMl = rest > 0 ? rest : 0;
    if (rest > 0) opens.push({ ml: rest, line });
    left -= 1;
  }

  product.stock = legacySealed + lots.reduce((sum, line) => sum + sealedOf(line), 0);
  product.openMl = opens.map((entry) => entry.ml).filter((ml) => ml > 0);
  return { takes };
}

function creditRevenue(takes, money, units, currency) {
  if (!(money > 0) || !(units > 0)) return;
  const each = money / units;
  for (const take of takes || []) {
    const count = take.bottles + take.portions;
    if (!take.line || count <= 0) continue;
    take.line.revenue = roundMoney(Number(take.line.revenue || 0) + each * count, currency);
  }
}

function shareMoney(items, total, currency) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  let used = 0;
  return items.map((item, index) => {
    if (index === items.length - 1) return roundMoney(total - used, currency);
    const part = subtotal > 0 ? roundMoney((total * item.unitPrice * item.qty) / subtotal, currency) : 0;
    used = roundMoney(used + part, currency);
    return part;
  });
}

function pullStock(products, shipments, wanted, currency) {
  const items = [];
  const takes = [];
  const byProduct = new Map();
  for (const [key, qty] of wanted) {
    const split = key.lastIndexOf(':');
    const productId = key.slice(0, split);
    const unit = key.slice(split + 1);
    const row = byProduct.get(productId) || { bottles: 0, portions: 0 };
    row[unit === 'portion' ? 'portions' : 'bottles'] += qty;
    byProduct.set(productId, row);
  }
  for (const [productId, row] of byProduct) {
    const product = products.find((item) => item.id === productId);
    if (!product) return { error: 'product_required' };
    const consumed = consumeProduct(product, shipments, row.bottles, row.portions, currency);
    if (consumed.error) return consumed;
    if (row.bottles > 0) {
      items.push({
        productId: product.id,
        nameFr: product.nameFr,
        nameAr: product.nameAr,
        brand: product.brand,
        concentration: product.concentration,
        volumeMl: product.volumeMl,
        unit: 'bottle',
        qty: row.bottles,
        unitPrice: product.sellPrice,
        unitCost: product.buyPrice || 0,
        lineTotal: roundMoney(product.sellPrice * row.bottles, currency),
      });
      takes.push((consumed.takes || []).map((take) => ({ line: take.line, bottles: take.bottles, portions: 0 })));
    }
    if (row.portions > 0) {
      const price = portionPrice(product, currency);
      items.push({
        productId: product.id,
        nameFr: product.nameFr,
        nameAr: product.nameAr,
        brand: product.brand,
        concentration: product.concentration,
        volumeMl: PORTION_ML,
        unit: 'portion',
        qty: row.portions,
        unitPrice: price,
        unitCost: portionCost(product, currency),
        lineTotal: roundMoney(price * row.portions, currency),
      });
      takes.push((consumed.takes || []).map((take) => ({ line: take.line, bottles: 0, portions: take.portions })));
    }
  }
  return { items, takes };
}

export function applyExpense(state, input) {
  const currency = currencyOf(state);
  const amount = roundMoney(parseMoney(input.amount), currency);
  const description = String(input.description || '').trim().slice(0, 160);
  if (!(amount > 0)) return { error: 'bad_price' };
  if (!description) return { error: 'required_fields' };
  const spentAt = parseWhen(input.spentAt);
  if (!spentAt) return { error: 'required_fields' };
  const row = {
    id: uid(),
    amount,
    description,
    category: EXPENSE_CATEGORIES.includes(input.category) ? input.category : '',
    spentAt: spentAt.toISOString(),
    createdAt: new Date().toISOString(),
  };
  return { state: { ...state, expenses: [row, ...(state.expenses || [])] } };
}

export function applyDeleteExpense(state, id) {
  return { state: { ...state, expenses: (state.expenses || []).filter((row) => row.id !== id) } };
}

export function applyShipment(state, input) {
  const currency = currencyOf(state);
  const total = roundMoney(parseMoney(input.total), currency);
  if (!(total > 0)) return { error: 'bad_price' };
  const arrivedAt = parseWhen(input.arrivedAt);
  if (!arrivedAt) return { error: 'required_fields' };
  const products = state.products.map((product) => ({ ...product, openMl: cleanOpen(product.openMl) }));
  const lines = [];
  for (const line of input.lines || []) {
    const qty = Math.floor(Number(line.qty) || 0);
    const unitCost = roundMoney(parseMoney(line.unitCost), currency);
    if (qty < 1 || !(unitCost > 0)) return { error: 'need_price' };
    let product = line.productId ? products.find((item) => item.id === line.productId) : null;
    if (line.productId && !product) return { error: 'product_required' };
    if (!product) {
      const nameFr = String(line.nameFr || '').trim().slice(0, 80);
      const nameAr = String(line.nameAr || '').trim().slice(0, 80);
      const brand = String(line.brand || '').trim().slice(0, 60);
      const sellPrice = roundMoney(parseMoney(line.sellPrice), currency);
      const volumeMl = Math.round(Number(line.volumeMl) || 0);
      if (!nameFr || !nameAr || !brand || !(volumeMl > 0)) return { error: 'required_fields' };
      if (!(sellPrice > 0)) return { error: 'need_price' };
      let portionSell = 0;
      if (volumeMl === 100 || volumeMl === 200) {
        portionSell = roundMoney(parseMoney(line.portionSell), currency);
        if (!(portionSell > 0)) return { error: 'need_price' };
      }
      product = {
        id: uid(),
        nameFr,
        nameAr,
        brand,
        ref: `A-${uid().slice(0, 6).toUpperCase()}`,
        concentration: line.concentration || 'edp',
        volumeMl,
        gender: line.gender || 'mixed',
        buyPrice: unitCost,
        sellPrice,
        portionSell,
        stock: 0,
        openMl: [],
        minStock: 1,
        image: cleanImage(line.image),
        createdAt: new Date().toISOString(),
      };
      products.unshift(product);
    }
    product.stock += qty;
    product.buyPrice = unitCost;
    lines.push({
      productId: product.id,
      nameFr: product.nameFr,
      nameAr: product.nameAr,
      brand: product.brand,
      qty,
      unitCost,
      sellPrice: product.sellPrice,
      volumeMl: product.volumeMl,
      soldBottles: 0,
      soldPortions: 0,
      openedBottles: 0,
      goneBottles: 0,
      openMl: 0,
      revenue: 0,
    });
  }
  const perfumeCost = roundMoney(lines.reduce((sum, line) => sum + line.unitCost * line.qty, 0), currency);
  const extraCost = roundMoney(total - perfumeCost, currency);
  const id = uid();
  const stamp = arrivedAt.toISOString();
  const restocks = [...(state.restocks || [])];
  for (const line of lines) {
    restocks.unshift({
      id: uid(),
      productId: line.productId,
      nameFr: line.nameFr,
      nameAr: line.nameAr,
      qty: line.qty,
      unitCost: line.unitCost,
      noteKey: 'shipment',
      shipmentId: id,
      note: '',
      createdAt: stamp,
    });
  }
  const shipment = {
    id,
    total,
    perfumeCost,
    extraCost,
    lines,
    note: String(input.note || '').trim().slice(0, 200),
    arrivedAt: stamp,
    createdAt: new Date().toISOString(),
  };
  return { state: { ...state, products, restocks, shipments: [shipment, ...(state.shipments || [])] } };
}

export function applyUpdateShipment(state, input) {
  const currency = currencyOf(state);
  const shipments = cloneShipments(state.shipments);
  const shipment = shipments.find((row) => row.id === input.id);
  if (!shipment) return { error: 'product_required' };
  const total = roundMoney(parseMoney(input.total), currency);
  if (!(total > 0)) return { error: 'bad_price' };
  const arrivedAt = parseWhen(input.arrivedAt);
  if (!arrivedAt) return { error: 'required_fields' };
  shipment.total = total;
  shipment.arrivedAt = arrivedAt.toISOString();
  shipment.perfumeCost = roundMoney(shipment.lines.reduce((sum, line) => sum + Number(line.unitCost) * Number(line.qty), 0), currency);
  shipment.extraCost = roundMoney(shipment.total - shipment.perfumeCost, currency);
  if (input.note !== undefined) shipment.note = String(input.note || '').trim().slice(0, 200);
  return { state: { ...state, shipments } };
}

export function applyDeleteShipment(state, id) {
  if (!id) return { error: 'product_required' };
  const shipment = (state.shipments || []).find((row) => row.id === id);
  if (!shipment) return { error: 'product_required' };
  let next = state;
  for (const line of shipment.lines || []) {
    const result = applyDelete(next, line.productId);
    if (!result.error) next = result.state;
  }
  return {
    state: {
      ...next,
      shipments: (next.shipments || []).filter((row) => row.id !== id),
    },
  };
}

export function applyAddPerfume(state, input) {
  const currency = currencyOf(state);
  const shipments = cloneShipments(state.shipments);
  const shipment = shipments.find((row) => row.id === input.shipmentId);
  if (!shipment) return { error: 'product_required' };
  const products = state.products.map((product) => ({ ...product, openMl: cleanOpen(product.openMl) }));
  const qty = Math.floor(Number(input.qty) || 0);
  const unitCost = roundMoney(parseMoney(input.unitCost), currency);
  if (qty < 1 || !(unitCost > 0)) return { error: 'need_price' };
  const nameFr = String(input.nameFr || '').trim().slice(0, 80);
  const nameAr = String(input.nameAr || '').trim().slice(0, 80);
  const brand = String(input.brand || '').trim().slice(0, 60);
  const sellPrice = roundMoney(parseMoney(input.sellPrice), currency);
  const volumeMl = Math.round(Number(input.volumeMl) || 0);
  const image = cleanImage(input.image);
  if (!nameFr || !nameAr || !brand || !(volumeMl > 0) || !image) return { error: 'required_fields' };
  if (!(sellPrice > 0)) return { error: 'need_price' };
  let portionSell = 0;
  if (volumeMl === 100 || volumeMl === 200) {
    portionSell = roundMoney(parseMoney(input.portionSell), currency);
    if (!(portionSell > 0)) return { error: 'need_price' };
  }
  const product = {
    id: uid(),
    nameFr,
    nameAr,
    brand,
    ref: String(input.ref || '').trim().slice(0, 40) || `A-${uid().slice(0, 6).toUpperCase()}`,
    concentration: input.concentration || 'edp',
    volumeMl,
    gender: input.gender || 'mixed',
    buyPrice: unitCost,
    sellPrice,
    portionSell,
    stock: qty,
    openMl: [],
    minStock: Math.max(0, Math.floor(Number(input.minStock) || 1)),
    image,
    createdAt: new Date().toISOString(),
  };
  products.unshift(product);
  shipment.lines.push({
    productId: product.id,
    nameFr,
    nameAr,
    brand,
    qty,
    unitCost,
    sellPrice,
    volumeMl,
    soldBottles: 0,
    soldPortions: 0,
    openedBottles: 0,
    goneBottles: 0,
    openMl: 0,
    revenue: 0,
  });
  shipment.perfumeCost = roundMoney(shipment.lines.reduce((sum, line) => sum + line.unitCost * line.qty, 0), currency);
  shipment.extraCost = roundMoney(shipment.total - shipment.perfumeCost, currency);
  const restocks = [{
    id: uid(),
    productId: product.id,
    nameFr,
    nameAr,
    qty,
    unitCost,
    noteKey: 'shipment',
    shipmentId: shipment.id,
    note: '',
    createdAt: new Date().toISOString(),
  }, ...(state.restocks || [])];
  return { state: { ...state, products, restocks, shipments } };
}

export function applyLoan(state, input) {
  const currency = currencyOf(state);
  const client = String(input.client || '').trim().slice(0, 80);
  if (!client) return { error: 'client_required' };
  const dueAt = parseWhen(input.dueAt);
  if (!dueAt) return { error: 'required_fields' };
  const wanted = groupWanted(input.lines);
  if (wanted.size === 0) return { error: 'sale_disabled' };
  const products = state.products.map((product) => ({ ...product, openMl: cleanOpen(product.openMl) }));
  const shipments = cloneShipments(state.shipments);
  const drawn = pullStock(products, shipments, wanted, currency);
  if (drawn.error) return drawn;
  const catalogTotal = roundMoney(drawn.items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0), currency);
  const total = input.total === '' || input.total == null
    ? catalogTotal
    : roundMoney(parseMoney(input.total), currency);
  if (!(total > 0)) return { error: 'bad_price' };
  shareMoney(drawn.items, total, currency).forEach((money, index) => {
    creditRevenue(drawn.takes[index], money, drawn.items[index].qty, currency);
  });
  const createdAt = new Date();
  const remindAt = new Date(createdAt.getTime() + REMIND_DAYS * 24 * 60 * 60 * 1000);
  const loan = {
    id: uid(),
    client,
    contact: String(input.contact || '').trim().slice(0, 80),
    items: drawn.items,
    total,
    paid: 0,
    dueAt: dueAt.toISOString(),
    remindAt: remindAt.toISOString(),
    status: 'pending',
    payments: [],
    note: String(input.note || '').trim().slice(0, 200),
    createdAt: createdAt.toISOString(),
  };
  return { state: { ...state, products, shipments, loans: [loan, ...(state.loans || [])] } };
}

export function applyLoanPayment(state, input) {
  const currency = currencyOf(state);
  const loans = (state.loans || []).map((loan) => ({ ...loan, payments: [...(loan.payments || [])] }));
  const loan = loans.find((item) => item.id === input.loanId);
  if (!loan) return { error: 'product_required' };
  if (loan.status === 'paid') return { error: 'loan_paid' };
  const amount = roundMoney(parseMoney(input.amount), currency);
  const remaining = roundMoney(loan.total - loan.paid, currency);
  if (!(amount > 0) || amount > remaining) return { error: 'bad_price' };
  const paid = roundMoney(loan.paid + amount, currency);
  loan.paid = paid;
  loan.status = loanStatus(loan.total, paid);
  loan.payments.unshift({
    id: uid(),
    amount,
    at: new Date().toISOString(),
  });
  return { state: { ...state, loans } };
}

export function legacyPurchases(restocks) {
  return (restocks || []).reduce((sum, row) => {
    if (row.noteKey === 'shipment') return sum;
    return sum + (row.unitCost ? Number(row.unitCost) * Number(row.qty) : 0);
  }, 0);
}

export function perfumePurchaseCost(shipments, restocks) {
  const fromShipments = (shipments || []).reduce((sum, row) => sum + Number(row.perfumeCost || 0), 0);
  return fromShipments + legacyPurchases(restocks);
}

export function shippingCost(shipments) {
  return (shipments || []).reduce((sum, row) => sum + Number(row.extraCost || 0), 0);
}

export function expenseTotal(expenses) {
  return (expenses || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export function loanCollected(loans) {
  return (loans || []).reduce((sum, loan) => sum + Number(loan.paid || 0), 0);
}

export function loanOutstanding(loans) {
  return (loans || []).reduce((sum, loan) => sum + Math.max(0, Number(loan.total || 0) - Number(loan.paid || 0)), 0);
}

export function investmentOf(shipments, restocks) {
  const placed = (shipments || []).reduce((sum, row) => sum + Number(row.total || 0), 0);
  return placed + legacyPurchases(restocks);
}

export function netProfit(state) {
  return sumRevenue(state.sales)
    + loanCollected(state.loans)
    - perfumePurchaseCost(state.shipments, state.restocks)
    - shippingCost(state.shipments)
    - expenseTotal(state.expenses);
}

export function dueReminders(loans, now = new Date()) {
  return (loans || []).filter((loan) => loan.status !== 'paid' && new Date(loan.remindAt) <= now);
}

export function arrivageReport(shipment, products, currency = 'MRU') {
  const lines = (shipment?.lines || []).map((raw) => {
    const line = normalizeLine(raw);
    const product = (products || []).find((item) => item.id === line.productId);
    const sell = product ? Number(product.sellPrice) || 0 : line.sellPrice;
    const expected = roundMoney(line.qty * sell, currency);
    return {
      ...line,
      sell,
      sealed: sealedOf(line),
      expected,
      nameFr: product?.nameFr || line.nameFr,
      nameAr: product?.nameAr || line.nameAr,
      brand: product?.brand || line.brand,
      image: product?.image || '',
    };
  });
  const invested = Number(shipment?.total) || 0;
  const perfumeCost = Number(shipment?.perfumeCost) || lines.reduce((sum, line) => sum + line.unitCost * line.qty, 0);
  const charge = roundMoney(Number(shipment?.extraCost ?? (invested - perfumeCost)) || 0, currency);
  const recovered = roundMoney(lines.reduce((sum, line) => sum + line.revenue, 0), currency);
  const expected = roundMoney(lines.reduce((sum, line) => sum + line.expected, 0), currency);
  return {
    invested,
    perfumeCost,
    charge,
    recovered,
    recoverLeft: roundMoney(invested - recovered, currency),
    recoverRatio: invested > 0 ? recovered / invested : 0,
    expected,
    expectedLeft: roundMoney(expected - recovered, currency),
    expectedRatio: expected > 0 ? recovered / expected : 0,
    bottles: lines.reduce((sum, line) => sum + line.qty, 0),
    lines,
  };
}
