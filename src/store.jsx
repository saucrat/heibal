import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { apiUrl } from './api.js';
import { dayKey, money as formatMoney } from './format.js';
import { tr } from './i18n.js';
import { canPortion, initialState, maxPortions, sanitize } from './logic.js';

const StoreContext = createContext(null);

async function request(path, options = {}) {
  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => null);
    if (response.status === 401) return { error: body?.error || 'auth' };
    if (!response.ok) return { error: body?.error || 'server_down' };
    return body;
  } catch {
    return { error: 'server_down' };
  }
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(() => initialState());
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [productFilter, setProductFilter] = useState('all');
  const [intent, setIntent] = useState(null);
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const dataRef = useRef(data);
  const seq = useRef(0);
  dataRef.current = data;

  function toast(message) {
    const id = crypto.randomUUID();
    setToasts((list) => [...list, { id, message }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((item) => item.id !== id));
    }, 3200);
  }

  function take(state, okKey) {
    dataRef.current = state;
    setData(state);
    setReady(true);
    if (okKey) toast(tr(state.lang, okKey));
  }

  async function run(path, options, okKey) {
    const mine = ++seq.current;
    const result = await request(path, options);
    if (result?.error === 'auth') {
      if (mine === seq.current) {
        setAuthed(false);
        setReady(true);
      }
      return result;
    }
    if (result?.error || !result?.state) {
      if (mine === seq.current) toast(tr(dataRef.current.lang, result?.error || 'server_down'));
      const fresh = await request('/api/ledger');
      if (mine === seq.current && fresh?.state) take(fresh.state);
      else if (mine === seq.current) setReady(true);
      return result || { error: 'server_down' };
    }
    if (mine !== seq.current) return result;
    take(result.state, okKey);
    return result;
  }

  useEffect(() => {
    const mine = ++seq.current;
    let gone = false;
    (async () => {
      const session = await request('/api/session');
      if (gone || mine !== seq.current) return;
      if (!session?.ok) {
        setAuthed(false);
        setReady(true);
        return;
      }
      setAuthed(true);
      const result = await request('/api/ledger');
      if (gone || mine !== seq.current) return;
      if (result?.state) take(result.state);
      else {
        if (result?.error !== 'auth') toast(tr(dataRef.current.lang, result?.error || 'server_down'));
        setReady(true);
      }
    })();
    return () => { gone = true; };
  }, []);

  useEffect(() => {
    if (authed !== true) return;
    document.documentElement.lang = data.lang === 'ar' ? 'ar' : 'fr';
    document.documentElement.dir = data.lang === 'ar' ? 'rtl' : 'ltr';
    document.title = data.lang === 'ar'
      ? '7B Parfumes — إدارة المخزون'
      : '7B Parfumes — Gestion du stock';
  }, [authed, data.lang]);

  const t = (key, vars) => tr(data.lang, key, vars);
  const currency = data.settings.currency;

  function roomFor(product, cart, unit) {
    const bottles = cart.find((line) => line.productId === product.id && line.unit !== 'portion')?.qty || 0;
    if (unit === 'portion') {
      return maxPortions({ ...product, stock: Math.max(0, product.stock - bottles) });
    }
    return product.stock;
  }

  function addToCart(productId, qty = 1, unit = 'bottle') {
    const product = dataRef.current.products.find((item) => item.id === productId);
    const mode = unit === 'portion' && canPortion(product) ? 'portion' : 'bottle';
    if (!product) return;
    setCart((prev) => {
      const limit = roomFor(product, prev, mode);
      const current = prev.find((line) => line.productId === productId && (line.unit || 'bottle') === mode)?.qty || 0;
      const next = Math.min(limit, current + qty);
      if (next < 1) return prev;
      if (!current) return [...prev, { productId, qty: next, unit: mode }];
      return prev.map((line) => (
        line.productId === productId && (line.unit || 'bottle') === mode ? { ...line, qty: next, unit: mode } : line
      ));
    });
    setPage('counter');
  }

  const value = {
    ...data,
    ready,
    authed,
    page,
    setPage,
    productFilter,
    setProductFilter,
    intent,
    setIntent,
    cart,
    receipt,
    setReceipt,
    settingsOpen,
    setSettingsOpen,
    toasts,
    t,
    currency,
    money: (amount) => formatMoney(amount, currency),
    openProducts(filter = 'all') {
      setProductFilter(filter);
      setPage('counter');
    },
    openNewProduct() {
      setPage('shipments');
    },
    openFiche(id, start = 'fiche') {
      setIntent({ id, start });
      setPage('counter');
    },
    setLang(lang) {
      return run('/api/settings', { method: 'PUT', body: JSON.stringify({ lang }) });
    },
    setCurrency(next) {
      return run('/api/settings', { method: 'PUT', body: JSON.stringify({ currency: next }) });
    },
    addToCart,
    setCartQty(productId, qty, unit = 'bottle') {
      const product = dataRef.current.products.find((item) => item.id === productId);
      const mode = unit === 'portion' ? 'portion' : 'bottle';
      setCart((prev) => {
        if (!product) return prev.filter((line) => !(line.productId === productId && (line.unit || 'bottle') === mode));
        const next = Math.floor(Number(qty) || 0);
        if (next < 1) return prev.filter((line) => !(line.productId === productId && (line.unit || 'bottle') === mode));
        const others = prev.filter((line) => !(line.productId === productId && (line.unit || 'bottle') === mode));
        const limit = roomFor(product, others, mode);
        return prev.map((line) => (
          line.productId === productId && (line.unit || 'bottle') === mode
            ? { ...line, qty: Math.min(limit, next), unit: mode }
            : line
        ));
      });
    },
    setCartUnit(productId, fromUnit, toUnit) {
      const product = dataRef.current.products.find((item) => item.id === productId);
      const from = fromUnit === 'portion' ? 'portion' : 'bottle';
      const mode = toUnit === 'portion' && canPortion(product) ? 'portion' : 'bottle';
      if (!product || from === mode) return;
      setCart((prev) => {
        const source = prev.find((line) => line.productId === productId && (line.unit || 'bottle') === from);
        if (!source) return prev;
        const without = prev.filter((line) => line !== source);
        const limit = roomFor(product, without, mode);
        if (limit < 1) return prev;
        const dest = without.find((line) => line.productId === productId && (line.unit || 'bottle') === mode);
        const qty = Math.min(limit, (dest?.qty || 0) + source.qty);
        if (!dest) return [...without, { productId, qty, unit: mode }];
        return without.map((line) => (line === dest ? { ...line, qty, unit: mode } : line));
      });
    },
    removeCartLine(productId, unit = 'bottle') {
      const mode = unit === 'portion' ? 'portion' : 'bottle';
      setCart((prev) => prev.filter((line) => !(line.productId === productId && (line.unit || 'bottle') === mode)));
    },
    clearCart() {
      setCart([]);
    },
    saveProduct(input) {
      const path = input.id ? `/api/products/${input.id}` : '/api/products';
      const method = input.id ? 'PUT' : 'POST';
      return run(path, { method, body: JSON.stringify(input) }, input.id ? 'updated' : 'product_ok');
    },
    async login(email, password) {
      const result = await request('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (!result?.ok) return { error: 'login_bad' };
      setAuthed(true);
      const ledger = await request('/api/ledger');
      if (ledger?.state) take(ledger.state);
      else setReady(true);
      return { ok: true };
    },
    async logout() {
      await request('/api/logout', { method: 'POST' });
      setCart([]);
      setReceipt(null);
      setSettingsOpen(false);
      const blank = initialState();
      dataRef.current = blank;
      setData(blank);
      setAuthed(false);
    },
    saveShipment(input) {
      return run('/api/shipments', { method: 'POST', body: JSON.stringify(input) }, 'shipment_ok');
    },
    updateShipment(id, input) {
      return run(`/api/shipments/${id}`, { method: 'PUT', body: JSON.stringify(input) }, 'shipment_ok');
    },
    removeShipment(id) {
      return run(`/api/shipments/${id}`, { method: 'DELETE' }, 'deleted');
    },
    addShipmentPerfume(id, input) {
      return run(`/api/shipments/${id}/perfumes`, { method: 'POST', body: JSON.stringify(input) }, 'product_ok');
    },
    saveLoan(input) {
      return run('/api/loans', { method: 'POST', body: JSON.stringify(input) }, 'loan_ok');
    },
    payLoan(id, amount) {
      return run(`/api/loans/${id}/payments`, { method: 'POST', body: JSON.stringify({ amount }) }, 'payment_ok');
    },
    saveExpense(input) {
      return run('/api/expenses', { method: 'POST', body: JSON.stringify(input) }, 'expense_ok');
    },
    removeExpense(id) {
      return run(`/api/expenses/${id}`, { method: 'DELETE' }, 'deleted');
    },
    removeProduct(id) {
      setCart((prev) => prev.filter((line) => line.productId !== id));
      setReceipt((current) => (current?.items?.some((item) => item.productId === id) ? null : current));
      return run(`/api/products/${id}`, { method: 'DELETE' }, 'deleted');
    },
    async sell(payload) {
      const result = await run('/api/sales', { method: 'POST', body: JSON.stringify(payload) }, 'sale_ok');
      if (result?.sale) {
        setCart([]);
        setReceipt(result.sale);
      }
      return result;
    },
    restock(input) {
      return run('/api/restocks', { method: 'POST', body: JSON.stringify(input) }, 'restock_ok');
    },
    writeoff(input) {
      return run('/api/writeoffs', { method: 'POST', body: JSON.stringify(input) }, 'writeoff_ok');
    },
    exportData() {
      const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `7b-parfumes-${dayKey(new Date())}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast(tr(dataRef.current.lang, 'saved'));
    },
    async confirmPin(pin) {
      return request('/api/pin', { method: 'POST', body: JSON.stringify({ pin }) });
    },
    importData(file, pin) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const parsed = sanitize(JSON.parse(String(reader.result)));
            if (!parsed) {
              toast(tr(dataRef.current.lang, 'import_error'));
              resolve({ error: 'import_error' });
              return;
            }
            const result = await run('/api/import', {
              method: 'POST',
              body: JSON.stringify({ ...parsed, pin }),
            }, 'imported');
            if (!result?.error) {
              setCart([]);
              setReceipt(null);
            }
            resolve(result || { error: 'import_error' });
          } catch {
            toast(tr(dataRef.current.lang, 'import_error'));
            resolve({ error: 'import_error' });
          }
        };
        reader.onerror = () => {
          toast(tr(dataRef.current.lang, 'import_error'));
          resolve({ error: 'import_error' });
        };
        reader.readAsText(file);
      });
    },
    async resetData(pin) {
      const lang = dataRef.current.lang;
      const nextCurrency = dataRef.current.settings.currency;
      const result = await run('/api/reset', {
        method: 'POST',
        body: JSON.stringify({ lang, currency: nextCurrency, pin }),
      }, 'cleared');
      if (!result?.error) {
        setCart([]);
        setReceipt(null);
        setPage('dashboard');
      }
      return result;
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Store missing');
  return store;
}
