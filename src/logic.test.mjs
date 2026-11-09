import assert from 'node:assert/strict';
import test from 'node:test';
import { dayKey } from './format.js';
import { tr } from './i18n.js';
import {
  activeSales,
  arrivageReport,
  applyAddPerfume,
  applyDelete,
  applyExpense,
  applyLoan,
  applyLoanPayment,
  applyProduct,
  applyRefund,
  applyRestock,
  applySale,
  applyShipment,
  applyWriteoff,
  dueReminders,
  expenseTotal,
  initialState,
  netProfit,
  perfumePurchaseCost,
  shippingCost,
  sanitize,
  stockRetail,
  sumProfit,
  sumPurchases,
  sumRevenue,
} from './logic.js';

test('stock, money in, profit, refund and purchases stay consistent', () => {
  let state = initialState('fr', 'DA');
  let result = applyProduct(state, {
    nameFr: 'Sauvage',
    nameAr: 'سوفاج',
    brand: 'Dior',
    ref: 'SAU-100',
    sellPrice: '15000',
    buyPrice: '8000',
    stock: '2',
    minStock: '1',
    volumeMl: '100',
    concentration: 'edp',
    gender: 'men',
    image: '/perfumes/dior-sauvage.jpg',
    portionSell: '1500',
  });
  assert.equal(result.error, undefined);
  state = result.state;
  assert.equal(state.products[0].stock, 2);
  assert.equal(sumPurchases(state.restocks), 16000);
  assert.equal(stockRetail(state.products), 30000);

  result = applySale(state, {
    lines: [{ productId: state.products[0].id, qty: 1 }],
    discount: 500,
    payment: 'cash',
    client: 'Amira',
  });
  state = result.state;
  assert.equal(state.products[0].stock, 1);
  assert.equal(sumRevenue(state.sales), 14500);
  assert.equal(sumProfit(state.sales), 6500);
  assert.equal(result.sale.client, 'Amira');

  assert.equal(applySale(state, { lines: [{ productId: state.products[0].id, qty: 5 }] }).error, 'no_stock');
  assert.equal(applySale(state, { lines: [{ productId: state.products[0].id, qty: 1 }], discount: 999999 }).error, 'discount_bad');

  assert.equal(applyRefund(state, result.sale.id).error, 'no_return');
  assert.equal(state.products[0].stock, 1);
  assert.equal(sumRevenue(state.sales), 14500);

  state = applySale(state, { lines: [{ productId: state.products[0].id, qty: 1 }], client: 'Amira' }).state;
  assert.equal(state.products[0].stock, 0);
  assert.equal(applyWriteoff(state, { productId: state.products[0].id, qty: 1, reason: 'tester' }).error, 'no_stock');
  assert.equal(sumRevenue(state.sales), 29500);

  state = applyRestock(state, { productId: state.products[0].id, qty: 3, unitCost: '7000' }).state;
  assert.equal(state.products[0].stock, 3);
  assert.equal(state.products[0].buyPrice, 7000);
  assert.equal(sumPurchases(state.restocks), 37000);

  const edited = applyProduct(state, {
    id: state.products[0].id,
    nameFr: 'Sauvage Elixir',
    nameAr: 'سوفاج',
    brand: 'Dior',
    ref: 'SAU-100',
    sellPrice: '16000',
    buyPrice: '7000',
    minStock: '1',
    volumeMl: '100',
    image: '/perfumes/dior-sauvage.jpg',
    portionSell: '1600',
  });
  assert.equal(edited.state.products[0].stock, 3);
  assert.equal(edited.state.products[0].sellPrice, 16000);
  state = applyWriteoff(state, { productId: state.products[0].id, qty: 1, reason: 'tester' }).state;
  assert.equal(state.products[0].stock, 2);

  const arabicOnly = applyProduct(initialState(), { nameAr: 'عود', sellPrice: '5000', stock: '0' });
  assert.equal(arabicOnly.error, 'required_name');
  assert.equal(applyProduct(initialState(), { sellPrice: '10' }).error, 'required_name');

  assert.equal(sanitize(state).products.length, 1);
  assert.equal(sanitize({}), null);
  assert.equal(dayKey(new Date(2026, 9, 29, 23, 30)), '2026-10-29');
});

test('100 ml and 200 ml sell by 10 ml, and an opened bottle stays opened', () => {
  const fields = {
    nameFr: 'Sauvage',
    nameAr: 'سوفاج',
    brand: 'Dior',
    ref: 'SAU-100',
    sellPrice: '10000',
    buyPrice: '5000',
    stock: '2',
    minStock: '1',
    concentration: 'edp',
    gender: 'men',
    image: '/perfumes/dior-sauvage.jpg',
    portionSell: '1000',
  };
  let state = applyProduct(initialState(), { ...fields, volumeMl: '100' }).state;
  const id = state.products[0].id;
  let result = applySale(state, {
    lines: [{ productId: id, qty: 1, unit: 'portion' }],
    client: 'A',
  });
  state = result.state;
  assert.equal(state.products[0].stock, 1);
  assert.deepEqual(state.products[0].openMl, [90]);
  assert.equal(result.sale.items[0].unitPrice, 1000);
  assert.equal(result.sale.total, 1000);

  result = applySale(state, { lines: [{ productId: id, qty: 1, unit: 'bottle' }], client: 'A' });
  state = result.state;
  assert.equal(state.products[0].stock, 0);
  assert.deepEqual(state.products[0].openMl, [90]);
  assert.equal(applySale(state, { lines: [{ productId: id, qty: 1, unit: 'bottle' }], client: 'A' }).error, 'no_stock');

  state = applySale(state, { lines: [{ productId: id, qty: 9, unit: 'portion' }], client: 'A' }).state;
  assert.equal(state.products[0].stock, 0);
  assert.deepEqual(state.products[0].openMl, []);

  state = applyProduct(initialState(), { ...fields, volumeMl: '200', stock: '1', portionSell: '500' }).state;
  result = applySale(state, { lines: [{ productId: state.products[0].id, qty: 1, unit: 'portion' }], client: 'A' });
  assert.equal(result.state.products[0].stock, 0);
  assert.deepEqual(result.state.products[0].openMl, [190]);
  assert.equal(result.sale.items[0].unitPrice, 500);

  state = applyProduct(initialState(), { ...fields, volumeMl: '50', ref: 'MD-50', stock: '1' }).state;
  assert.equal(applySale(state, {
    lines: [{ productId: state.products[0].id, qty: 1, unit: 'portion' }],
    client: 'A',
  }).error, 'no_portion');
});

test('deleting a perfume removes it from the journal', () => {
  const fields = {
    brand: 'Dior',
    ref: 'SAU-100',
    sellPrice: '10000',
    buyPrice: '4000',
    stock: '2',
    minStock: '1',
    volumeMl: '100',
    concentration: 'edp',
    gender: 'men',
    image: '/perfumes/dior-sauvage.jpg',
    portionSell: '1000',
  };
  let state = applyProduct(initialState(), { ...fields, nameFr: 'Sauvage', nameAr: 'سوفاج' }).state;
  const gone = state.products[0].id;
  state = applyProduct(state, { ...fields, nameFr: 'Bleu', nameAr: 'بلو', ref: 'BLU-100', sellPrice: '8000', buyPrice: '3000', stock: '2', image: '/perfumes/chanel-bleu.jpg' }).state;
  const kept = state.products.find((product) => product.nameFr === 'Bleu').id;

  state = applySale(state, {
    lines: [{ productId: gone, qty: 1 }, { productId: kept, qty: 1 }],
    discount: 1000,
    client: 'A',
  }).state;
  state = applySale(state, { lines: [{ productId: gone, qty: 1 }], client: 'B' }).state;
  state = applyRestock(state, { productId: gone, qty: 1, unitCost: '4000' }).state;
  state = applyWriteoff(state, { productId: kept, qty: 1, reason: 'tester' }).state;
  state = applyWriteoff(state, { productId: gone, qty: 1, reason: 'gift' }).state;

  state = applyDelete(state, gone).state;

  assert.equal(state.products.some((product) => product.id === gone), false);
  assert.equal(state.products.some((product) => product.id === kept), true);
  assert.equal(state.sales.length, 1);
  assert.deepEqual(state.sales[0].items.map((item) => item.productId), [kept]);
  assert.equal(state.sales[0].subtotal, 8000);
  assert.equal(state.sales[0].discount, 1000);
  assert.equal(state.sales[0].total, 7000);
  assert.equal(state.restocks.some((row) => row.productId === gone), false);
  assert.equal(state.writeoffs.some((row) => row.productId === gone), false);
  assert.equal(state.writeoffs.some((row) => row.productId === kept), true);
  assert.equal(sumRevenue(state.sales), 7000);
});

test('shipments, expenses and loans stay in separate accounts', () => {
  const fields = {
    nameFr: 'Sauvage',
    nameAr: 'سوفاج',
    brand: 'Dior',
    ref: 'SAU-100',
    sellPrice: '10000',
    buyPrice: '4000',
    stock: '1',
    minStock: '1',
    volumeMl: '100',
    concentration: 'edp',
    gender: 'men',
    image: '/perfumes/dior-sauvage.jpg',
    portionSell: '1200',
  };
  let state = applyProduct(initialState(), fields).state;
  const id = state.products[0].id;
  state = applyShipment(state, {
    total: '50000',
    arrivedAt: '2026-09-11',
    lines: [{ productId: id, qty: 3, unitCost: '10000' }],
  }).state;
  assert.equal(state.shipments[0].perfumeCost, 30000);
  assert.equal(state.shipments[0].extraCost, 20000);
  assert.equal(state.products[0].stock, 4);
  assert.equal(state.products[0].buyPrice, 10000);
  assert.equal(perfumePurchaseCost(state.shipments, state.restocks), 30000 + 4000);
  assert.equal(shippingCost(state.shipments), 20000);

  state = applyExpense(state, { amount: '500', description: 'Eau', category: 'water', spentAt: '2026-09-12' }).state;
  assert.equal(expenseTotal(state.expenses), 500);
  assert.equal(state.restocks.some((row) => row.noteKey === 'shipment'), true);

  state = applySale(state, { lines: [{ productId: id, qty: 1, unit: 'portion' }], client: 'A' }).state;
  assert.equal(state.sales[0].items[0].unitPrice, 1200);

  const loan = applyLoan(state, {
    client: 'Aminetou',
    contact: '22112211',
    dueAt: '2026-12-01',
    total: '8000',
    lines: [{ productId: id, qty: 1, unit: 'bottle' }],
  });
  state = loan.state;
  assert.equal(state.loans[0].status, 'pending');
  assert.equal(state.loans[0].total, 8000);
  assert.equal(dueReminders(state.loans, new Date('2026-01-01')).length, 0);
  const later = new Date(state.loans[0].remindAt);
  later.setDate(later.getDate() + 1);
  assert.equal(dueReminders(state.loans, later).length, 1);

  state = applyLoanPayment(state, { loanId: state.loans[0].id, amount: '3000' }).state;
  assert.equal(state.loans[0].status, 'partial');
  assert.equal(state.loans[0].paid, 3000);
  state = applyLoanPayment(state, { loanId: state.loans[0].id, amount: '5000' }).state;
  assert.equal(state.loans[0].status, 'paid');
  assert.equal(dueReminders(state.loans, later).length, 0);
  assert.equal(netProfit(state), 1200 + 8000 - (30000 + 4000) - 20000 - 500);
});

test('an arrivage keeps its own stock, charge fee and recovery', () => {
  let state = applyShipment(initialState(), {
    total: '50000',
    arrivedAt: '2026-09-12',
    lines: [
      { nameFr: 'Rose', nameAr: 'ورد', brand: 'Dior', volumeMl: 100, sellPrice: '20000', portionSell: '2500', qty: 1, unitCost: '10000' },
      { nameFr: 'Oud', nameAr: 'عود', brand: 'Lattafa', volumeMl: 100, sellPrice: '30000', portionSell: '3000', qty: 1, unitCost: '15000' },
      { nameFr: 'Musk', nameAr: 'مسك', brand: 'Armaf', volumeMl: 50, sellPrice: '30000', qty: 1, unitCost: '5000' },
    ],
  }).state;
  const shipment = state.shipments[0];
  assert.equal(shipment.perfumeCost, 30000);
  assert.equal(shipment.extraCost, 20000);
  assert.equal(state.products.length, 3);
  assert.equal(state.products.every((product) => product.stock === 1), true);

  const rose = state.products.find((product) => product.nameFr === 'Rose');
  state = applySale(state, { lines: [{ productId: rose.id, qty: 1, unit: 'bottle' }], client: 'A' }).state;
  let report = arrivageReport(state.shipments[0], state.products, 'MRU');
  assert.equal(report.recovered, 20000);
  assert.equal(report.recoverLeft, 30000);
  assert.equal(report.recoverRatio, 0.4);
  assert.equal(report.expected, 80000);
  assert.equal(report.expectedLeft, 60000);
  assert.equal(report.expectedRatio, 0.25);
  assert.equal(report.lines.find((line) => line.nameFr === 'Rose').sealed, 0);
  assert.equal(report.lines.find((line) => line.nameFr === 'Oud').sealed, 1);
  assert.equal(state.products.find((product) => product.id === rose.id).stock, 0);

  const oud = state.products.find((product) => product.nameFr === 'Oud');
  state = applySale(state, { lines: [{ productId: oud.id, qty: 1, unit: 'portion' }], client: 'B' }).state;
  report = arrivageReport(state.shipments[0], state.products, 'MRU');
  const oudLine = report.lines.find((line) => line.nameFr === 'Oud');
  assert.equal(oudLine.soldPortions, 1);
  assert.equal(oudLine.sealed, 0);
  assert.equal(oudLine.openMl, 90);
  assert.equal(report.recovered, 23000);

  state = applyProduct(initialState(), {
    nameFr: 'Old', nameAr: 'قديم', brand: 'Dior', ref: 'OLD', sellPrice: '10000', buyPrice: '4000',
    stock: '1', minStock: '0', volumeMl: '100', concentration: 'edp', gender: 'men',
    image: '/perfumes/dior-sauvage.jpg', portionSell: '1000',
  }).state;
  const oldId = state.products[0].id;
  state = applyShipment(state, {
    total: '10000',
    arrivedAt: '2026-10-05',
    lines: [{ productId: oldId, qty: 1, unitCost: '4000' }],
  }).state;
  state = applySale(state, { lines: [{ productId: oldId, qty: 1 }], client: 'C' }).state;
  assert.equal(state.shipments[0].lines[0].soldBottles, 0);
  assert.equal(state.products[0].stock, 1);
  state = applySale(state, { lines: [{ productId: oldId, qty: 1 }], client: 'C' }).state;
  assert.equal(state.shipments[0].lines[0].soldBottles, 1);
  assert.equal(state.shipments[0].lines[0].revenue, 10000);
});

test('a charge starts with its price and receives perfumes afterwards', () => {
  let state = applyShipment(initialState(), { total: '50000', arrivedAt: '2026-09-12', lines: [] }).state;
  assert.equal(state.products.length, 0);
  assert.equal(state.shipments[0].perfumeCost, 0);
  assert.equal(state.shipments[0].extraCost, 50000);
  state = applyAddPerfume(state, {
    shipmentId: state.shipments[0].id,
    nameFr: 'Rose',
    nameAr: 'ورد',
    brand: 'Dior',
    volumeMl: 100,
    sellPrice: '20000',
    portionSell: '2500',
    qty: 2,
    unitCost: '10000',
    image: '/perfumes/dior-sauvage.jpg',
  }).state;
  const report = arrivageReport(state.shipments[0], state.products, 'MRU');
  assert.equal(state.products.length, 1);
  assert.equal(state.products[0].stock, 2);
  assert.equal(report.perfumeCost, 20000);
  assert.equal(report.charge, 30000);
  assert.equal(report.lines.length, 1);
  state = applyDelete(state, state.products[0].id).state;
  assert.equal(state.products.length, 0);
  assert.equal(state.shipments.length, 1);
  assert.equal(state.shipments[0].lines.length, 0);
  assert.equal(state.shipments[0].perfumeCost, 0);
  assert.equal(state.shipments[0].extraCost, 50000);
});

test('both languages have the cash labels', () => {
  assert.notEqual(tr('ar', 'today_in'), tr('fr', 'today_in'));
  assert.match(tr('fr', 'profit_caption', { n: '10 DA' }), /10 DA/);
  assert.match(tr('ar', 'profit_caption', { n: '10 DA' }), /10 DA/);
});
