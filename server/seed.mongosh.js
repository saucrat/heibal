// Sample books for 7B Parfumes. Reload with: mongosh --file server/seed.mongosh.js
const shop = db.getSiblingDB('parfumes7b');

const catalog = [
  { id: 'dior-sauvage', nameFr: 'Sauvage', nameAr: 'سوفاج', brand: 'Dior', ref: 'SAU-100', concentration: 'edp', volumeMl: 100, gender: 'men', buyPrice: 8500, sellPrice: 16500, minStock: 2, opening: 6 },
  { id: 'chanel-bleu', nameFr: 'Bleu de Chanel', nameAr: 'بلو دو شانيل', brand: 'Chanel', ref: 'BLEU-100', concentration: 'edp', volumeMl: 100, gender: 'men', buyPrice: 12000, sellPrice: 24000, minStock: 2, opening: 4 },
  { id: 'ysl-y', nameFr: 'Y Eau de Parfum', nameAr: 'واي', brand: 'Yves Saint Laurent', ref: 'Y-100', concentration: 'edp', volumeMl: 100, gender: 'men', buyPrice: 9000, sellPrice: 18500, minStock: 2, opening: 5 },
  { id: 'armani-adg', nameFr: 'Acqua di Gio', nameAr: 'أكوا دي جيو', brand: 'Giorgio Armani', ref: 'ADG-100', concentration: 'edt', volumeMl: 100, gender: 'men', buyPrice: 7000, sellPrice: 14500, minStock: 1, opening: 4 },
  { id: 'dior-miss', nameFr: 'Miss Dior', nameAr: 'ميس ديور', brand: 'Dior', ref: 'MD-50', concentration: 'edp', volumeMl: 50, gender: 'women', buyPrice: 9500, sellPrice: 19000, minStock: 1, opening: 4 },
  { id: 'ysl-opium', nameFr: 'Black Opium', nameAr: 'بلاك أوبيوم', brand: 'Yves Saint Laurent', ref: 'BO-90', concentration: 'edp', volumeMl: 90, gender: 'women', buyPrice: 8000, sellPrice: 17000, minStock: 1, opening: 4 },
  { id: 'lattafa-khamrah', nameFr: 'Khamrah', nameAr: 'خمرة', brand: 'Lattafa', ref: 'KH-100', concentration: 'edp', volumeMl: 100, gender: 'mixed', buyPrice: 2800, sellPrice: 6500, minStock: 3, opening: 6 },
  { id: 'armaf-cdnim', nameFr: 'Club de Nuit Intense', nameAr: 'كلوب دو نوي', brand: 'Armaf', ref: 'CDN-105', concentration: 'edt', volumeMl: 105, gender: 'men', buyPrice: 2200, sellPrice: 5500, minStock: 2, opening: 8 },
  { id: 'afnan-9pm', nameFr: '9pm', nameAr: 'ناين بي إم', brand: 'Afnan', ref: '9PM-100', concentration: 'edp', volumeMl: 100, gender: 'men', buyPrice: 3200, sellPrice: 7000, minStock: 2, opening: 6 },
  { id: 'haramain-oud', nameFr: 'Oud Royal', nameAr: 'عود رويال', brand: 'Al Haramain', ref: 'OR-100', concentration: 'extrait', volumeMl: 100, gender: 'mixed', buyPrice: 14000, sellPrice: 28000, minStock: 1, opening: 4 },
];

const byId = Object.fromEntries(catalog.map((product) => [product.id, product]));
const opened = '2026-09-01T09:00:00.000Z';

function line(productId, qty) {
  const product = byId[productId];
  return {
    productId,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    brand: product.brand,
    concentration: product.concentration,
    volumeMl: product.volumeMl,
    qty,
    unitPrice: product.sellPrice,
    unitCost: product.buyPrice,
    lineTotal: product.sellPrice * qty,
  };
}

function movement(productId, qty, createdAt, note) {
  const product = byId[productId];
  return {
    productId,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    qty,
    createdAt,
    note: note || '',
  };
}

function sale(id, createdAt, payment, client, lines, extra = {}) {
  const items = lines.map(([productId, qty]) => line(productId, qty));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discount = extra.discount || 0;
  const doc = {
    _id: id,
    id,
    items,
    subtotal,
    discount,
    total: subtotal - discount,
    payment,
    client: client || '',
    note: extra.note || '',
    status: extra.status || 'paid',
    createdAt,
  };
  if (extra.refundedAt) doc.refundedAt = extra.refundedAt;
  return doc;
}

const restocks = catalog.map((product) => ({
  _id: `in-${product.id}`,
  id: `in-${product.id}`,
  ...movement(product.id, product.opening, opened, ''),
  unitCost: product.buyPrice,
  noteKey: 'initial',
}));

restocks.push({
  _id: 'in-khamrah-oct',
  id: 'in-khamrah-oct',
  ...movement('lattafa-khamrah', 4, '2026-10-18T10:30:00.000Z', 'Réassort Nouakchott'),
  unitCost: 2800,
  noteKey: '',
});

const writeoffs = [{
  _id: 'out-oud-tester',
  id: 'out-oud-tester',
  ...movement('haramain-oud', 1, '2026-10-15T11:00:00.000Z', 'Flacon ouvert au comptoir'),
  reason: 'tester',
}];

const sales = [
  sale('sale-1020-sauvage', '2026-10-20T10:15:00.000Z', 'cash', 'Abdellahi', [['dior-sauvage', 1]]),
  sale('sale-1020-miss', '2026-10-20T16:40:00.000Z', 'card', 'Mariem', [['dior-miss', 1]]),
  sale('sale-1020-9pm', '2026-10-20T18:05:00.000Z', 'cash', '', [['afnan-9pm', 1]]),
  sale('sale-1022-adg', '2026-10-22T11:20:00.000Z', 'cash', 'Zeinebou', [['armani-adg', 1]]),
  sale('sale-1022-9pm', '2026-10-22T14:10:00.000Z', 'cash', 'Sidi', [['afnan-9pm', 2]]),
  sale('sale-1022-oud', '2026-10-22T17:45:00.000Z', 'card', 'Cheikh', [['haramain-oud', 1]]),
  sale('sale-1024-y', '2026-10-24T09:50:00.000Z', 'card', 'Fatimetou', [['ysl-y', 1]]),
  sale('sale-1024-opium', '2026-10-24T13:30:00.000Z', 'cash', 'Aminetou', [['ysl-opium', 1]]),
  sale('sale-1024-cdn', '2026-10-24T18:15:00.000Z', 'cash', '', [['armaf-cdnim', 2]]),
  sale('sale-1025-miss', '2026-10-25T15:20:00.000Z', 'cash', 'Vatimetou', [['dior-miss', 1]], {
    status: 'refunded',
    refundedAt: '2026-10-25T16:10:00.000Z',
    note: 'Échange',
  }),
  sale('sale-1026-sauvage', '2026-10-26T10:05:00.000Z', 'cash', 'Mohamed Lemine', [['dior-sauvage', 1]]),
  sale('sale-1026-khamrah', '2026-10-26T12:40:00.000Z', 'cash', '', [['lattafa-khamrah', 2]]),
  sale('sale-1027-bleu', '2026-10-27T11:25:00.000Z', 'card', 'Cheikh', [['chanel-bleu', 1]]),
  sale('sale-1027-oud', '2026-10-27T16:50:00.000Z', 'cash', 'Abdellahi', [['haramain-oud', 1]], { note: 'Livraison Tevragh Zeina' }),
  sale('sale-1028-y', '2026-10-28T15:10:00.000Z', 'card', 'Fatimetou', [['ysl-y', 1]]),
  sale('sale-1029-opium', '2026-10-29T10:35:00.000Z', 'cash', 'Mariem', [['ysl-opium', 1]]),
  sale('sale-1029-mix', '2026-10-29T17:20:00.000Z', 'cash', 'Sidi', [['afnan-9pm', 2], ['armaf-cdnim', 1]]),
  sale('sale-1030-sauvage', '2026-10-30T09:40:00.000Z', 'card', 'Mohamed Lemine', [['dior-sauvage', 1]]),
  sale('sale-1030-khamrah', '2026-10-30T11:05:00.000Z', 'cash', 'Aminetou', [['lattafa-khamrah', 2]]),
];

const stock = Object.fromEntries(catalog.map((product) => [product.id, 0]));
for (const row of restocks) stock[row.productId] += row.qty;
for (const row of sales) {
  if (row.status === 'refunded') continue;
  for (const item of row.items) stock[item.productId] -= item.qty;
}
for (const row of writeoffs) stock[row.productId] -= row.qty;

const products = catalog.map((product) => {
  if (stock[product.id] < 0) {
    throw new Error(`${product.id} stock went negative (${stock[product.id]})`);
  }
  return {
    _id: product.id,
    id: product.id,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    brand: product.brand,
    ref: product.ref,
    concentration: product.concentration,
    volumeMl: product.volumeMl,
    gender: product.gender,
    buyPrice: product.buyPrice,
    sellPrice: product.sellPrice,
    stock: stock[product.id],
    minStock: product.minStock,
    image: `/perfumes/${product.id}.jpg`,
    createdAt: opened,
  };
});

const paid = sales.filter((row) => row.status !== 'refunded');
const revenue = paid.reduce((sum, row) => sum + row.total, 0);
const today = paid
  .filter((row) => row.createdAt.startsWith('2026-10-30'))
  .reduce((sum, row) => sum + row.total, 0);

shop.products.drop();
shop.sales.drop();
shop.restocks.drop();
shop.writeoffs.drop();
shop.meta.drop();

shop.meta.insertOne({ _id: 'shop', v: 1, lang: 'fr', currency: 'MRU' });
shop.products.insertMany(products);
shop.sales.insertMany(sales);
shop.restocks.insertMany(restocks);
shop.writeoffs.insertMany(writeoffs);

shop.products.createIndex({ id: 1 }, { unique: true });
shop.sales.createIndex({ createdAt: -1 });
shop.restocks.createIndex({ createdAt: -1 });
shop.writeoffs.createIndex({ createdAt: -1 });

print(`parfumes7b  ${products.length} products  ${sales.length} sales  ${restocks.length} entries  ${writeoffs.length} exit`);
print(`today ${today} MRU   since opening ${revenue} MRU`);
print('stock ' + products.map((product) => `${product.ref}:${product.stock}`).join('  '));
