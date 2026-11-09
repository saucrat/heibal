import { db } from './db.js';
import {
  applyAddPerfume,
  applyDelete,
  applyExpense,
  applyDeleteExpense,
  applyLoan,
  applyLoanPayment,
  applyProduct,
  applyRefund,
  applyRestock,
  applySale,
  applyShipment,
  applyWriteoff,
  initialState,
  sanitize,
} from '../src/logic.js';

const CURRENCIES = ['MRU', 'EUR', 'MAD', 'TND', 'DA'];
const BOOKS = ['products', 'sales', 'restocks', 'writeoffs', 'expenses', 'loans', 'shipments'];

let chain = Promise.resolve();

function enqueue(task) {
  const run = chain.then(task, task);
  chain = run.then(() => {}, () => {});
  return run;
}

function strip(doc) {
  const copy = { ...doc };
  delete copy._id;
  return copy;
}

export async function readLedger() {
  const database = db();
  const meta = await database.collection('meta').findOne({ _id: 'shop' });
  const [products, sales, restocks, writeoffs, expenses, loans, shipments] = await Promise.all([
    database.collection('products').find({}).toArray(),
    database.collection('sales').find({}).sort({ createdAt: -1 }).toArray(),
    database.collection('restocks').find({}).sort({ createdAt: -1 }).toArray(),
    database.collection('writeoffs').find({}).sort({ createdAt: -1 }).toArray(),
    database.collection('expenses').find({}).sort({ spentAt: -1 }).toArray(),
    database.collection('loans').find({}).sort({ createdAt: -1 }).toArray(),
    database.collection('shipments').find({}).sort({ arrivedAt: -1 }).toArray(),
  ]);
  return sanitize({
    v: 1,
    lang: meta?.lang || 'fr',
    settings: { currency: meta?.currency || 'MRU' },
    products: products.map(strip),
    sales: sales.map(strip),
    restocks: restocks.map(strip),
    writeoffs: writeoffs.map(strip),
    expenses: expenses.map(strip),
    loans: loans.map(strip),
    shipments: shipments.map(strip),
  }) || initialState(meta?.lang || 'fr', meta?.currency || 'MRU');
}

async function writeLedger(state) {
  const clean = sanitize(state) || initialState();
  const database = db();
  await database.collection('meta').replaceOne(
    { _id: 'shop' },
    { _id: 'shop', v: 1, lang: clean.lang, currency: clean.settings.currency },
    { upsert: true },
  );
  for (const name of BOOKS) {
    const collection = database.collection(name);
    await collection.deleteMany({});
    const docs = clean[name];
    if (docs.length) {
      await collection.insertMany(docs.map((doc) => ({ ...doc, _id: doc.id })));
    }
  }
  return clean;
}

function mutate(change) {
  return enqueue(async () => {
    const state = await readLedger();
    const result = change(state);
    if (!result || result.error || !result.state) return result || { error: 'bad_price' };
    const saved = await writeLedger(result.state);
    return { ...result, state: saved };
  });
}

export function saveProduct(input) {
  return mutate((state) => applyProduct(state, input || {}));
}

export function removeProduct(id) {
  return mutate((state) => applyDelete(state, id));
}

export function sell(payload) {
  return mutate((state) => applySale(state, payload || {}));
}

export function refund(saleId) {
  return mutate((state) => applyRefund(state, saleId));
}

export function restock(input) {
  return mutate((state) => applyRestock(state, input || {}));
}

export function writeoff(input) {
  return mutate((state) => applyWriteoff(state, input || {}));
}

export function removeExpense(id) {
  return mutate((state) => applyDeleteExpense(state, id));
}

export function saveShipment(input) {
  return mutate((state) => applyShipment(state, input || {}));
}

export function addShipmentPerfume(input) {
  return mutate((state) => applyAddPerfume(state, input || {}));
}

export function saveLoan(input) {
  return mutate((state) => applyLoan(state, input || {}));
}

export function payLoan(input) {
  return mutate((state) => applyLoanPayment(state, input || {}));
}

export function saveExpense(input) {
  return mutate((state) => applyExpense(state, input || {}));
}

export function updateSettings(patch = {}) {
  return mutate((state) => ({
    state: {
      ...state,
      lang: patch.lang === 'ar' || patch.lang === 'fr' ? patch.lang : state.lang,
      settings: {
        currency: CURRENCIES.includes(patch.currency) ? patch.currency : state.settings.currency,
      },
    },
  }));
}

export function importLedger(payload) {
  return enqueue(async () => {
    const parsed = sanitize(payload);
    if (!parsed) return { error: 'import_error' };
    const saved = await writeLedger(parsed);
    return { state: saved };
  });
}

export function resetLedger(patch = {}) {
  return enqueue(async () => {
    const lang = patch.lang === 'ar' ? 'ar' : 'fr';
    const currency = CURRENCIES.includes(patch.currency) ? patch.currency : 'MRU';
    const saved = await writeLedger(initialState(lang, currency));
    return { state: saved };
  });
}
