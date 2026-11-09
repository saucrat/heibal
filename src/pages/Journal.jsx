import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../empty.jsx';
import { dayKey, displayName, formatDate, formatTime, saleLineName } from '../format.js';
import { useStore } from '../store.jsx';
import { Choice, PerfumePhotos } from '../ui.jsx';

const FILTERS = [
  ['all', 'all'],
  ['sale', 'sale_type'],
  ['restock', 'restock_type'],
  ['writeoff', 'writeoff_type'],
  ['refund', 'refund_type'],
];

export function Journal() {
  const { t, lang, products, sales, restocks, writeoffs, money, setReceipt } = useStore();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(40);

  useEffect(() => {
    setLimit(40);
  }, [filter, query]);

  const rows = useMemo(() => {
    const list = [
      ...sales.map((sale) => ({
        id: `s-${sale.id}`,
        type: sale.status === 'refunded' ? 'refund' : 'sale',
        at: sale.createdAt,
        sale,
      })),
      ...restocks.map((restock) => ({
        id: `r-${restock.id}`,
        type: 'restock',
        at: restock.createdAt,
        restock,
      })),
      ...writeoffs.map((writeoff) => ({
        id: `w-${writeoff.id}`,
        type: 'writeoff',
        at: writeoff.createdAt,
        writeoff,
      })),
    ];
    list.sort((a, b) => new Date(b.at) - new Date(a.at));
    return list;
  }, [sales, restocks, writeoffs]);

  const filtered = rows.filter((row) => {
    if (filter !== 'all' && row.type !== filter) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    const chunks = [];
    if (row.sale) {
      chunks.push(row.sale.client, row.sale.note, row.sale.payment);
      row.sale.items.forEach((item) => chunks.push(item.nameFr, item.nameAr, item.brand));
    }
    if (row.restock) chunks.push(row.restock.nameFr, row.restock.nameAr, row.restock.note, row.restock.noteKey);
    if (row.writeoff) chunks.push(row.writeoff.nameFr, row.writeoff.nameAr, row.writeoff.note, row.writeoff.reason);
    return chunks.filter(Boolean).join(' ').toLowerCase().includes(needle);
  });

  const visible = filtered.slice(0, limit);

  function imagesOf(row) {
    const ids = row.sale
      ? row.sale.items.map((item) => item.productId)
      : [row.restock?.productId || row.writeoff?.productId];
    return ids.map((id) => products.find((product) => product.id === id)?.image);
  }

  function titleOf(row) {
    if (row.sale) return row.sale.items.map((item) => saleLineName(item, lang)).join(' · ');
    if (row.restock) return `${displayName(row.restock, lang)} ×${row.restock.qty}`;
    return `${displayName(row.writeoff, lang)} ×${row.writeoff.qty}`;
  }

  function noteOf(row) {
    if (row.sale) return [row.sale.client, row.sale.note].filter(Boolean).join(' — ');
    if (row.restock) {
      const label = row.restock.noteKey ? t(row.restock.noteKey) : '';
      return [label, row.restock.note].filter(Boolean).join(' — ');
    }
    return [t(row.writeoff.reason), row.writeoff.note].filter(Boolean).join(' — ');
  }

  function amountOf(row) {
    if (row.sale) {
      const sign = row.sale.status === 'refunded' ? '− ' : '+ ';
      return { text: `${sign}${money(row.sale.total)}`, className: row.sale.status === 'refunded' ? 'struck' : 'money-in' };
    }
    if (row.restock?.unitCost) return { text: `− ${money(row.restock.unitCost * row.restock.qty)}`, className: 'money-out' };
    return null;
  }

  const groups = [];
  for (const row of visible) {
    const key = dayKey(row.at);
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) groups.push({ key, at: row.at, rows: [row] });
    else last.rows.push(row);
  }

  return (
    <>
      <div className="book-tools">
        <label className="search">
          <span className="sr">{t('search_journal')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search_journal')} />
        </label>
        <Choice
          ariaLabel={t('status')}
          value={filter}
          onValueChange={setFilter}
          options={FILTERS.map(([id, key]) => ({ value: id, label: t(key) }))}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          kind={query || filter !== 'all' ? 'search' : 'journal'}
          title={t('no_journal')}
        />
      ) : (
        <div className="book">
          {groups.map((group) => (
            <section key={group.key} className="book-day">
              <header>
                <strong>{formatDate(group.at, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                <span dir="ltr">{group.rows.length}</span>
              </header>
              <ul>
                {group.rows.map((row) => {
                  const amount = amountOf(row);
                  return (
                    <li key={row.id}>
                      {row.sale ? (
                        <button type="button" className="move-row" onClick={() => setReceipt(row.sale)}>
                          <time dir="ltr">{formatTime(row.at, lang)}</time>
                          <span className="move-copy">
                            <PerfumePhotos images={imagesOf(row)} />
                            <span>
                              <bdi>{titleOf(row)}</bdi>
                              <small>{[t(`${row.type}_type`), noteOf(row)].filter(Boolean).join(' · ')}</small>
                            </span>
                          </span>
                          {amount ? <strong className={amount.className} dir="ltr">{amount.text}</strong> : <strong />}
                        </button>
                      ) : (
                        <div className="move-row">
                          <time dir="ltr">{formatTime(row.at, lang)}</time>
                          <span className="move-copy">
                            <PerfumePhotos images={imagesOf(row)} />
                            <span>
                              <bdi>{titleOf(row)}</bdi>
                              <small>{[t(`${row.type}_type`), noteOf(row)].filter(Boolean).join(' · ')}</small>
                            </span>
                          </span>
                          {amount ? <strong className={amount.className} dir="ltr">{amount.text}</strong> : <strong />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {limit < filtered.length ? (
        <div className="empty-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setLimit((value) => value + 40)}>{t('more')}</button>
        </div>
      ) : null}

    </>
  );
}
