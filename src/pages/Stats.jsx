import { useMemo, useState } from 'react';
import { assetUrl } from '../api.js';
import { EmptyState } from '../empty.jsx';
import {
  dayKey,
  displayName,
  formatDate,
  inPeriod,
  shiftDays,
  startOfDay,
} from '../format.js';
import { activeSales, expenseTotal, investmentOf, loanOutstanding, perfumePurchaseCost, shippingCost, sumRevenue } from '../logic.js';
import { useStore } from '../store.jsx';
import { Chart, Choice } from '../ui.jsx';

const PERIODS = [
  ['7', 'period_7'],
  ['30', 'period_30'],
  ['90', 'period_90'],
  ['all', 'period_all'],
];

function dayBuckets(count) {
  const today = startOfDay(new Date());
  const days = [];
  for (let index = count - 1; index >= 0; index -= 1) days.push(startOfDay(shiftDays(today, -index)));
  return days;
}

export function Stats() {
  const { t, lang, sales, restocks, products: catalog, money, expenses, loans, shipments } = useStore();
  const [period, setPeriod] = useState('30');

  const view = useMemo(() => {
    const paid = activeSales(sales).filter((sale) => inPeriod(sale.createdAt, period));
    const bought = restocks.filter((row) => row.noteKey !== 'shipment' && inPeriod(row.createdAt, period));
    const arrived = (shipments || []).filter((row) => inPeriod(row.arrivedAt, period));
    const spentRows = (expenses || []).filter((row) => inPeriod(row.spentAt, period));
    const collected = (loans || []).reduce((sum, loan) => (
      sum + (loan.payments || []).filter((pay) => inPeriod(pay.at, period)).reduce((part, pay) => part + Number(pay.amount || 0), 0)
    ), 0);
    const perfume = perfumePurchaseCost(arrived, bought);
    const freight = shippingCost(arrived);
    const spent = expenseTotal(spentRows);
    const revenue = sumRevenue(paid);
    const profit = revenue + collected - perfume - freight - spent;
    const units = paid.reduce((sum, sale) => sum + sale.items.reduce((qty, item) => qty + item.qty, 0), 0);
    const basket = paid.length ? revenue / paid.length : 0;

    const byDay = {};
    for (const sale of paid) {
      const key = dayKey(sale.createdAt);
      byDay[key] = (byDay[key] || 0) + Number(sale.total || 0);
    }

    let chart = [];
    if (period === '7' || period === '30') {
      chart = dayBuckets(Number(period)).map((date) => {
        const key = dayKey(date);
        return {
          key,
          value: byDay[key] || 0,
          today: key === dayKey(new Date()),
          label: formatDate(date, lang, { day: 'numeric' }),
          title: formatDate(date, lang, { weekday: 'short', day: 'numeric', month: 'short' }),
          display: money(byDay[key] || 0),
        };
      });
    } else if (period === '90') {
      const days = dayBuckets(90);
      for (let index = 0; index < days.length; index += 7) {
        const slice = days.slice(index, index + 7);
        const value = slice.reduce((sum, date) => sum + (byDay[dayKey(date)] || 0), 0);
        chart.push({
          key: dayKey(slice[0]),
          value,
          today: false,
          label: formatDate(slice[0], lang, { day: 'numeric', month: 'short' }),
          title: `${formatDate(slice[0], lang, { day: 'numeric', month: 'short' })}`,
          display: money(value),
        });
      }
    } else {
      const months = new Map();
      for (const sale of paid) {
        const date = new Date(sale.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.set(key, (months.get(key) || 0) + Number(sale.total || 0));
      }
      chart = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-18).map(([key, value]) => {
        const [year, month] = key.split('-');
        const date = new Date(Number(year), Number(month) - 1, 1);
        return {
          key,
          value,
          today: false,
          label: formatDate(date, lang, { month: 'short' }),
          title: formatDate(date, lang, { month: 'long', year: 'numeric' }),
          display: money(value),
        };
      });
    }

    const products = new Map();
    const brands = new Map();
    for (const sale of paid) {
      const share = sale.subtotal ? sale.total / sale.subtotal : 1;
      for (const item of sale.items) {
        const key = item.productId || displayName(item, lang);
        const image = catalog.find((product) => product.id === item.productId)?.image || '';
        const lineRevenue = item.unitPrice * item.qty * share;
        const current = products.get(key) || { name: displayName(item, lang), brand: item.brand, qty: 0, revenue: 0, image };
        current.qty += item.qty;
        current.revenue += lineRevenue;
        if (!current.image && image) current.image = image;
        products.set(key, current);
        const brandKey = item.brand || 'none';
        const brand = brands.get(brandKey) || { name: item.brand || t('none'), revenue: 0, qty: 0, image, best: 0 };
        brand.revenue += lineRevenue;
        brand.qty += item.qty;
        if (image && lineRevenue >= brand.best) {
          brand.image = image;
          brand.best = lineRevenue;
        }
        brands.set(brandKey, brand);
      }
    }

    const top = [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const brandRows = [...brands.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    const cash = paid.filter((sale) => sale.payment !== 'card').reduce((sum, sale) => sum + sale.total, 0);
    const card = paid.filter((sale) => sale.payment === 'card').reduce((sum, sale) => sum + sale.total, 0);
    const maxTop = Math.max(...top.map((row) => row.revenue), 1);
    const maxBrand = Math.max(...brandRows.map((row) => row.revenue), 1);

    const owed = loanOutstanding(loans || []);
    const invested = investmentOf(shipments || [], restocks);
    return {
      revenue, profit, perfume, freight, spent, collected, owed, invested,
      units, basket, count: paid.length, chart, top, brandRows, cash, card, maxTop, maxBrand,
    };
  }, [sales, restocks, expenses, loans, shipments, catalog, period, lang, money, t]);

  return (
    <>
      <div className="stats-bar">
        <p className="eyebrow">{t('stats_sub')}</p>
        <Choice
          ariaLabel={t('period')}
          value={period}
          onValueChange={setPeriod}
          options={PERIODS.map(([id, key]) => ({ value: id, label: t(key) }))}
        />
      </div>

      <section className="stage">
        <article className="stage-main">
          <p className="eyebrow">{t('revenue')}</p>
          <p className="stage-num" dir="ltr">{money(view.revenue)}</p>
          <div className="stage-meta">
            <span>{view.units === 1 ? t('one_sold') : t('units_caption', { n: view.units })}</span>
          </div>
          <Chart rows={view.chart} empty={t('no_data')} />
        </article>
        <aside className="ledger">
          <div className="ledger-row">
            <span>{t('net_profit')}</span>
            <strong dir="ltr">{money(view.profit)}</strong>
            <small>{t('collected')} · {money(view.collected)}</small>
          </div>
          <div className="ledger-row">
            <span>{t('perfume_cost')}</span>
            <strong dir="ltr">{money(view.perfume)}</strong>
            <small>{t('shipping_cost')} · {money(view.freight)}</small>
          </div>
          <div className="ledger-row">
            <span>{t('nav_expenses')}</span>
            <strong dir="ltr">{money(view.spent)}</strong>
            <small>{t('outstanding')} · {money(view.owed)}</small>
          </div>
          <div className="ledger-row">
            <span>{t('investment')}</span>
            <strong dir="ltr">{money(view.invested)}</strong>
          </div>
          <div className="ledger-row">
            <span>{t('avg_basket')}</span>
            <strong dir="ltr">{money(view.basket)}</strong>
            <small dir="ltr">{view.count}</small>
          </div>
          <div className="ledger-row">
            <span>{t('cash')}</span>
            <strong dir="ltr">{money(view.cash)}</strong>
          </div>
          <div className="ledger-row">
            <span>{t('card')}</span>
            <strong dir="ltr">{money(view.card)}</strong>
          </div>
        </aside>
      </section>

      <section className="stats-split">
        <article className="panel">
          <div className="panel-head"><h2>{t('top_products')}</h2></div>
          {view.top.length === 0 ? <EmptyState kind="rank" text={t('top_empty')} compact /> : (
            <ol className="rank">
              {view.top.map((row, index) => (
                <li key={`${row.name}-${index}`}>
                  <span className="rank-index" dir="ltr">{index + 1}</span>
                  {row.image ? <img className="rank-photo" src={assetUrl(row.image)} alt="" /> : <span className="rank-photo" />}
                  <div>
                    <bdi>{row.name}</bdi>
                    {row.brand ? <small>{row.brand}</small> : null}
                    <div className="rank-track"><span style={{ width: `${(row.revenue / view.maxTop) * 100}%` }} /></div>
                  </div>
                  <strong dir="ltr">{money(row.revenue)}</strong>
                </li>
              ))}
            </ol>
          )}
        </article>
        <article className="panel">
          <div className="panel-head"><h2>{t('by_brand')}</h2></div>
          {view.brandRows.length === 0 ? <EmptyState kind="brand" text={t('brand_empty')} compact /> : (
            <ol className="rank">
              {view.brandRows.map((row) => (
                <li key={row.name}>
                  <span className="rank-index" />
                  {row.image ? <img className="rank-photo" src={assetUrl(row.image)} alt="" /> : <span className="rank-photo" />}
                  <div>
                    <bdi>{row.name}</bdi>
                    <small dir="ltr">{row.qty} {t('pieces')}</small>
                    <div className="rank-track"><span style={{ width: `${(row.revenue / view.maxBrand) * 100}%` }} /></div>
                  </div>
                  <strong dir="ltr">{money(row.revenue)}</strong>
                </li>
              ))}
            </ol>
          )}
        </article>
      </section>

    </>
  );
}
