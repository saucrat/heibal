import { Command } from 'cmdk';
import {
  BookOpen,
  ChartColumn,
  Columns2,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  Search,
  Settings,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { assetUrl } from './api.js';
import { Login } from './Login.jsx';
import { Receipt } from './Receipt.jsx';
import { displayName, localeOf } from './format.js';
import { SettingsModal } from './modals.jsx';
import { Counter } from './pages/Counter.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Expenses } from './pages/Expenses.jsx';
import { Journal } from './pages/Journal.jsx';
import { Loans } from './pages/Loans.jsx';
import { Shipments } from './pages/Shipments.jsx';
import { Stats } from './pages/Stats.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { Modal } from './ui.jsx';
import { maxPortions, portionPrice } from './logic.js';

const NAV = [
  ['dashboard', 'nav_dashboard', LayoutDashboard],
  ['counter', 'nav_counter', Columns2],
  ['shipments', 'nav_shipments', Package],
  ['expenses', 'nav_expenses', Wallet],
  ['loans', 'nav_loans', HandCoins],
  ['journal', 'nav_journal', BookOpen],
  ['stats', 'nav_stats', ChartColumn],
];

function DeskCommand({ open, onOpenChange }) {
  const { t, lang, products, setPage, addToCart, openProducts } = useStore();

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('command_ph')}
      overlayClassName="command-overlay"
      contentClassName="command-dialog"
      vimBindings={false}
    >
      <Command.Input placeholder={t('command_ph')} />
      <Command.List>
        <Command.Empty>{t('command_empty')}</Command.Empty>
        <Command.Group heading={t('command_pages')}>
          {NAV.map(([id, key]) => (
            <Command.Item
              key={id}
              value={t(key)}
              onSelect={() => {
                setPage(id);
                onOpenChange(false);
              }}
            >
              {t(key)}
            </Command.Item>
          ))}
          <Command.Item
            value={`${t('new_arrivage')} ${t('nav_shipments')}`}
            onSelect={() => {
              setPage('shipments');
              onOpenChange(false);
            }}
          >
            <Plus size={16} strokeWidth={1.75} />
            {t('new_arrivage')}
          </Command.Item>
        </Command.Group>
        <Command.Group heading={t('command_perfumes')}>
          {products.map((product) => (
            <Command.Item
              key={product.id}
              value={`${product.nameFr} ${product.nameAr} ${product.brand} ${product.ref}`}
              onSelect={() => {
                if (product.stock > 0) addToCart(product.id);
                else if (maxPortions(product) > 0 && portionPrice(product) > 0) addToCart(product.id, 1, 'portion');
                else openProducts('out');
                onOpenChange(false);
              }}
            >
              <span>
                {product.image ? <img className="command-photo" src={assetUrl(product.image)} alt="" /> : null}
                <span>
                  <bdi>{displayName(product, lang)}</bdi>
                  {product.brand ? <small>{product.brand}</small> : null}
                </span>
              </span>
              <em dir="ltr">{product.stock}</em>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function Shell() {
  const {
    t, lang, page, setPage, cart, setLang, settingsOpen, setSettingsOpen,
    receipt, setReceipt, toasts, ready, logout,
  } = useStore();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function onKey(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const ticketCount = cart.reduce((sum, line) => sum + line.qty, 0);
  const dateLabel = new Date().toLocaleDateString(localeOf(lang), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="wordmark" dir="ltr">
            <span>7B</span>
            <em>Parfumes</em>
          </div>
          <span className="brand-sub">{t('app_sub')}</span>
        </div>
        <nav className="nav">
          {NAV.map(([id, key, Icon]) => (
            <button
              type="button"
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span>{t(key)}</span>
              {id === 'counter' && ticketCount > 0 ? <em className="nav-count" dir="ltr">{ticketCount}</em> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <p>{t('local_hint')}</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <p className="date">{dateLabel}</p>
          <button type="button" className="command-launch" onClick={() => setCommandOpen(true)}>
            <Search size={16} strokeWidth={1.75} />
            <span>{t('command_ph')}</span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="top-tools">
            <div className="lang" role="group" aria-label={t('language')}>
              <button type="button" className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
              <button type="button" className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button>
            </div>
            <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label={t('settings')}>
              <Settings size={18} strokeWidth={1.75} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm gate-out" onClick={logout}>
              <LogOut size={15} strokeWidth={1.75} />
              {t('logout')}
            </button>
          </div>
        </header>
        <div className="content rise" key={ready ? page : 'loading'}>
          {ready ? (
            <>
              {page === 'dashboard' && <Dashboard />}
              {page === 'counter' && <Counter />}
              {page === 'shipments' && <Shipments />}
              {page === 'expenses' && <Expenses />}
              {page === 'loans' && <Loans />}
              {page === 'journal' && <Journal />}
              {page === 'stats' && <Stats />}
            </>
          ) : (
            <section className="empty">
              <h2>{t('loading')}</h2>
            </section>
          )}
        </div>
      </div>

      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}
      <DeskCommand open={commandOpen} onOpenChange={setCommandOpen} />
      {receipt ? (
        <Modal title={t('receipt')} onClose={() => setReceipt(null)} closeLabel={t('close')}>
          <Receipt sale={receipt} />
          <div className="modal-actions no-print">
            <button type="button" className="btn btn-ghost" onClick={() => window.print()}>{t('print')}</button>
            <button type="button" className="btn btn-gold" onClick={() => { setReceipt(null); setPage('counter'); }}>{t('new_sale')}</button>
          </div>
        </Modal>
      ) : null}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((item) => <div className="toast" key={item.id}>{item.message}</div>)}
      </div>
    </div>
  );
}

function Root() {
  const { authed } = useStore();
  if (authed !== true) return <Login checking={authed === null} />;
  return <Shell />;
}

export function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
