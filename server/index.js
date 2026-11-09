import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { checkLogin, clearSessionCookie, readSession, setSessionCookie } from './auth.js';
import { connect, db, dbName } from './db.js';
import {
  addShipmentPerfume,
  importLedger,
  payLoan,
  readLedger,
  refund,
  removeExpense,
  removeProduct,
  resetLedger,
  restock,
  saveExpense,
  saveLoan,
  saveProduct,
  saveShipment,
  sell,
  updateSettings,
  writeoff,
} from './ledger.js';

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';
const production = process.env.NODE_ENV === 'production';
const origins = String(process.env.CORS_ORIGIN || 'http://127.0.0.1:5173,http://localhost:5173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: origins, credentials: true }));

app.use((req, res, next) => {
  if (req.path === '/api/health') return next();
  if (req.path === '/api/login' && req.method === 'POST') return next();
  if (req.path === '/api/session' && req.method === 'GET') return next();
  if (req.path === '/api/logout' && req.method === 'POST') return next();
  if (req.method === 'GET' && req.path.startsWith('/api/media/')) return next();
  if (readSession(req)) return next();
  res.status(401).json({ error: 'auth' });
});

app.use(express.json({ limit: '2mb' }));

function allowDangerous(_req, res, next) {
  if (production && process.env.ALLOW_DANGEROUS !== '1') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

app.post('/api/login', (req, res) => {
  if (!checkLogin(req.body?.email, req.body?.password)) {
    res.status(401).json({ error: 'login_bad' });
    return;
  }
  setSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  if (!readSession(req)) {
    res.status(401).json({ error: 'auth' });
    return;
  }
  res.json({ ok: true });
});

app.post('/api/media', express.raw({ type: 'image/jpeg', limit: '6mb' }), async (req, res) => {
  try {
    if (!req.body?.length) {
      res.status(400).json({ error: 'photo' });
      return;
    }
    const id = randomUUID();
    await db().collection('media').replaceOne(
      { _id: id },
      {
        _id: id,
        contentType: 'image/jpeg',
        bytes: Buffer.from(req.body),
        createdAt: new Date().toISOString(),
      },
      { upsert: true },
    );
    res.json({ url: `/api/media/${id}.jpg` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'photo' });
  }
});

app.get('/api/media/:name', async (req, res) => {
  try {
    const id = String(req.params.name || '').replace(/\.jpg$/i, '');
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      res.status(404).end();
      return;
    }
    const doc = await db().collection('media').findOne({ _id: id });
    if (!doc?.bytes) {
      res.status(404).end();
      return;
    }
    const bytes = Buffer.isBuffer(doc.bytes) ? doc.bytes : Buffer.from(doc.bytes.buffer || doc.bytes);
    res.setHeader('Content-Type', doc.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(bytes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'photo' });
  }
});

function send(res, result) {
  if (!result || result.error || !result.state) {
    res.status(400).json({ error: result?.error || 'bad_price' });
    return;
  }
  const body = { state: result.state };
  if (result.sale) body.sale = result.sale;
  res.json(body);
}

async function handle(res, work) {
  try {
    send(res, await work());
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'server_down' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: dbName });
});

app.get('/api/ledger', async (_req, res) => {
  try {
    res.json({ state: await readLedger() });
  } catch (error) {
    console.error(error);
    res.status(503).json({ error: 'server_down' });
  }
});

app.put('/api/settings', (req, res) => handle(res, () => updateSettings(req.body)));
app.post('/api/products', (req, res) => handle(res, () => saveProduct(req.body)));
app.put('/api/products/:id', (req, res) => handle(res, () => saveProduct({ ...req.body, id: req.params.id })));
app.delete('/api/products/:id', (req, res) => handle(res, () => removeProduct(req.params.id)));
app.post('/api/sales', (req, res) => handle(res, () => sell(req.body)));
app.post('/api/sales/:id/refund', (req, res) => handle(res, () => refund(req.params.id)));
app.post('/api/restocks', (req, res) => handle(res, () => restock(req.body)));
app.post('/api/writeoffs', (req, res) => handle(res, () => writeoff(req.body)));
app.post('/api/expenses', (req, res) => handle(res, () => saveExpense(req.body)));
app.delete('/api/expenses/:id', (req, res) => handle(res, () => removeExpense(req.params.id)));
app.post('/api/shipments', (req, res) => handle(res, () => saveShipment(req.body)));
app.post('/api/shipments/:id/perfumes', (req, res) => handle(res, () => addShipmentPerfume({ ...req.body, shipmentId: req.params.id })));
app.post('/api/loans', (req, res) => handle(res, () => saveLoan(req.body)));
app.post('/api/loans/:id/payments', (req, res) => handle(res, () => payLoan({ ...req.body, loanId: req.params.id })));
app.post('/api/import', allowDangerous, (req, res) => handle(res, () => importLedger(req.body)));
app.post('/api/reset', allowDangerous, (req, res) => handle(res, () => resetLedger(req.body)));

let database;
try {
  database = await connect();
} catch (error) {
  console.error('MongoDB connection failed');
  console.error(error.message);
  process.exit(1);
}

const counts = {
  products: await database.collection('products').countDocuments(),
  sales: await database.collection('sales').countDocuments(),
};
app.listen(port, host, () => {
  console.log(`7B Parfumes API  http://${host}:${port}  db ${dbName}  ${counts.products} products, ${counts.sales} sales`);
});
