import { MongoClient } from 'mongodb';

const url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
export const dbName = process.env.MONGO_DB || 'parfumes7b';

let client;
let database;

export async function connect() {
  client = new MongoClient(url, { serverSelectionTimeoutMS: 12000 });
  await client.connect();
  database = client.db(dbName);

  const books = ['products', 'sales', 'restocks', 'writeoffs', 'expenses', 'loans', 'shipments'];
  for (const name of books) {
    await database.collection(name).createIndex({ id: 1 }, { unique: true });
  }
  await database.collection('sales').createIndex({ createdAt: -1 });
  await database.collection('restocks').createIndex({ createdAt: -1 });
  await database.collection('writeoffs').createIndex({ createdAt: -1 });
  await database.collection('expenses').createIndex({ spentAt: -1 });
  await database.collection('loans').createIndex({ createdAt: -1 });
  await database.collection('shipments').createIndex({ arrivedAt: -1 });
  await database.collection('media').createIndex({ createdAt: -1 });

  const meta = database.collection('meta');
  const shop = await meta.findOne({ _id: 'shop' });
  if (!shop) {
    await meta.insertOne({ _id: 'shop', v: 1, lang: 'ar', currency: 'MRU' });
  }

  return database;
}

export function db() {
  if (!database) throw new Error('Database not connected');
  return database;
}
