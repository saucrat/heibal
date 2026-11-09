import {
  activeSales,
  expenseTotal,
  investmentOf,
  isLow,
  loanCollected,
  loanOutstanding,
  netProfit,
  perfumePurchaseCost,
  shippingCost,
  stockCost,
  stockRetail,
  sumRevenue,
} from '../logic.js';
import {
  dayKey,
  displayName,
  formatDate,
  saleLineName,
  formatTime,
  isSameDay,
  shiftDays,
  startOfDay,
} from '../format.js';
import { assetUrl } from '../api.js';
import { EmptyState } from '../empty.jsx';
import { useStore } from '../store.jsx';
import { Chart, PerfumePhotos } from '../ui.jsx';

function unitsOf(sales) {
  return sales.reduce((sum, sale) => sum + sale.items.reduce((qty, item) => qty + item.qty, 0), 0);
}

export function Dashboard() {
  const {
    t, lang, products, sales, restocks, money, openNewProduct, openProducts, openFiche, setReceipt, setPage,
    expenses, loans, shipments,
  } = useStore();

  const paid = activeSales(sales);
  const todaySales = paid.filter((sale) => isSameDay(sale.createdAt));
  const yesterdaySales = paid.filter((sale) => isSameDay(sale.createdAt, shiftDays(new Date(), -1)));
  const todayTotal = sumRevenue(todaySales);
  const yesterdayTotal = sumRevenue(yesterdaySales);
  const allTotal = sumRevenue(sales);
  const retail = stockRetail(products);
  const cost = stockCost(products);
  const books = { sales, loans: loans || [], shipments: shipments || [], restocks, expenses: expenses || [] };
  const profitNet = netProfit(books);
  const perfumeCost = perfumePurchaseCost(books.shipments, restocks);
  const freight = shippingCost(books.shipments);
  const spent = expenseTotal(books.expenses);
  const collected = loanCollected(books.loans);
  const owed = loanOutstanding(books.loans);
  const invested = investmentOf(books.shipments, restocks);
  const cashOn = (day) => (loans || []).reduce((sum, loan) => (
    sum + (loan.payments || []).filter((pay) => isSameDay(pay.at, day)).reduce((part, pay) => part + Number(pay.amount || 0), 0)
  ), 0);
  const todayCash = todayTotal + cashOn(new Date());
  const yesterdayCash = yesterdayTotal + cashOn(shiftDays(new Date(), -1));
  const alerts = products.filter(isLow).sort((a, b) => a.stock - b.stock || displayName(a, lang).localeCompare(displayName(b, lang)));

  let compare = '';
  if (todayCash || yesterdayCash) {
    if (todayCash === yesterdayCash) compare = t('vs_same');
    else if (todayCash > yesterdayCash) compare = t('vs_up', { n: money(todayCash - yesterdayCash) });
    else compare = t('vs_down', { n: money(yesterdayCash - todayCash) });
  }

  const byDay = {};
  for (const sale of paid) {
    const key = dayKey(sale.createdAt);
    byDay[key] = (byDay[key] || 0) + Number(sale.total || 0);
  }
  const chart = [];
  for (let index = 13; index >= 0; index -= 1) {
    const date = startOfDay(shiftDays(new Date(), -index));
    const key = dayKey(date);
    chart.push({
      key,
      value: byDay[key] || 0,
      today: index === 0,
      label: formatDate(date, lang, { day: 'numeric' }),
      title: formatDate(date, lang, { weekday: 'long', day: 'numeric', month: 'long' }),
      display: money(byDay[key] || 0),
    });
  }

  const emptyBook = products.length === 0 && sales.length === 0;

  return (
    <>
      <section className="stage">
        <article className="stage-main">
          <p className="eyebrow">{t('today_in')}</p>
          <p className="stage-num" dir="ltr">{money(todayCash)}</p>
          <div className="stage-meta">
            {cashOn(new Date()) > 0 ? <span>{t('collected')} · {money(cashOn(new Date()))}</span> : null}
            {compare ? <span className="delta-pill">{compare}</span> : null}
          </div>
          {emptyBook ? (
            <EmptyState
              kind="desk"
              title={t('empty_title')}
              text={t('empty_text')}
              action={<button type="button" className="btn btn-gold" onClick={openNewProduct}>{t('new_arrivage')}</button>}
            />
          ) : (
            <>
              <p className="eyebrow chart-label">{t('chart_title')}</p>
              <Chart rows={chart} empty={t('chart_empty')} />
            </>
          )}
        </article>
        <aside className="ledger">
          <div className="ledger-row">
            <span>{t('all_in')}</span>
            <strong dir="ltr">{money(allTotal)}</strong>
            <small>{t('collected')} · {money(collected)}</small>
          </div>
          <div className="ledger-row">
            <span>{t('sales_today')}</span>
            <strong dir="ltr">{todaySales.length}</strong>
            <small>{unitsOf(todaySales) === 1 ? t('one_article') : t('today_units', { n: unitsOf(todaySales) })}</small>
          </div>
          <div className="ledger-row">
            <span>{t('stock_value')}</span>
            <strong dir="ltr">{money(retail)}</strong>
            <small>{t('cost_caption', { n: money(cost) })}</small>
          </div>
          <div className="ledger-row">
            <span>{t('perfume_cost')}</span>
            <strong dir="ltr">{money(perfumeCost)}</strong>
            <small>{t('shipping_cost')} · {money(freight)}</small>
          </div>
          <div className={`ledger-row${alerts.length ? ' hot' : ''}`}>
            <span>{t('low_stock')}</span>
            <strong dir="ltr">{alerts.length}</strong>
            <small>{t('alert_caption')}</small>
          </div>
        </aside>
      </section>

      <section className="panel accounts">
        <div><span>{t('net_profit')}</span><strong dir="ltr">{money(profitNet)}</strong></div>
        <div><span>{t('cash_in')}</span><strong dir="ltr">{money(allTotal + collected)}</strong></div>
        <div><span>{t('collected')}</span><strong dir="ltr">{money(collected)}</strong></div>
        <div><span>{t('outstanding')}</span><strong dir="ltr">{money(owed)}</strong></div>
        <div><span>{t('nav_expenses')}</span><strong dir="ltr">{money(spent)}</strong></div>
        <div><span>{t('investment')}</span><strong dir="ltr">{money(invested)}</strong></div>
      </section>
      <section className="dash-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>{t('recent')}</h2>
            <button type="button" className="text-btn" onClick={() => setPage('journal')}>{t('nav_journal')}</button>
          </div>
          {sales.length === 0 ? <EmptyState kind="sales" text={t('recent_empty')} compact /> : (
            <ul className="move-list">
              {sales.slice(0, 6).map((sale) => (
                <li key={sale.id}>
                  <button type="button" className="move-row" onClick={() => setReceipt(sale)}>
                    <time dir="ltr">
                      {formatDate(sale.createdAt, lang, { day: 'numeric', month: 'short' })}
                      <small>{formatTime(sale.createdAt, lang)}</small>
                    </time>
                    <span className="move-copy perfume-line">
                      <PerfumePhotos images={sale.items.map((item) => products.find((product) => product.id === item.productId)?.image)} />
                      <span>
                        <bdi>{sale.items.map((item) => saleLineName(item, lang)).join(' · ')}</bdi>
                        <small>{[sale.client, t(sale.payment)].filter(Boolean).join(' · ')}</small>
                      </span>
                    </span>
                    <strong className={sale.status === 'refunded' ? 'struck' : 'money-in'} dir="ltr">
                      {sale.status === 'refunded' ? '− ' : '+ '}{money(sale.total)}
                    </strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="panel">
          <div className="panel-head">
            <h2>{t('alerts')}</h2>
            {alerts.length > 0 ? (
              <button type="button" className="text-btn" onClick={() => openProducts('low')}>{t('see_all')}</button>
            ) : null}
          </div>
          {alerts.length === 0 ? <EmptyState kind="calm" text={t('alerts_empty')} compact /> : (
            <ul className="alert-list">
              {alerts.slice(0, 6).map((product) => (
                <li key={product.id}>
                  <button type="button" className="alert-row" onClick={() => openFiche(product.id, 'fiche')}>
                    <span className="shelf-photo alert-photo">
                      {product.image ? <img src={assetUrl(product.image)} alt="" /> : null}
                    </span>
                    <span>
                      <bdi>{displayName(product, lang)}</bdi>
                      <small>{product.brand}</small>
                    </span>
                    <strong className={product.stock === 0 ? 'stock-num out' : 'stock-num low'} dir="ltr">{product.stock}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

    </>
  );
}
