import { useMemo, useState } from 'react';
import { assetUrl } from '../api.js';
import { displayName, formatDate, saleLineName } from '../format.js';
import { canPortion, loanCollected, loanOutstanding, portionPrice } from '../logic.js';
import { useStore } from '../store.jsx';
import { EmptyState } from '../empty.jsx';
import { Field, Modal } from '../ui.jsx';

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function percent(ratio) {
  const value = Math.round((Number(ratio) || 0) * 1000) / 10;
  return `${value}%`;
}

function Track({ ratio }) {
  const width = Math.max(0, Math.min(100, (Number(ratio) || 0) * 100));
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

function lineKey(productId, unit) {
  return `${productId}:${unit || 'bottle'}`;
}

export function Loans() {
  const { t, lang, products, loans, money, currency, saveLoan, payLoan } = useStore();
  const [creating, setCreating] = useState(false);
  const [client, setClient] = useState('');
  const [contact, setContact] = useState('');
  const [dueAt, setDueAt] = useState(todayInput);
  const [picked, setPicked] = useState({});
  const [pay, setPay] = useState({});
  const rows = loans || [];
  const inStock = useMemo(
    () => [...(products || [])].filter((item) => item.stock > 0 || (canPortion(item) && (item.openMl || []).some((ml) => ml >= 10))),
    [products],
  );

  const lines = useMemo(
    () => Object.entries(picked)
      .map(([key, qty]) => {
        const [productId, unit] = key.split(':');
        return { productId, unit, qty };
      })
      .filter((line) => line.qty > 0),
    [picked],
  );

  const estimate = useMemo(() => lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return sum;
    const price = line.unit === 'portion' ? portionPrice(product, currency) : Number(product.sellPrice) || 0;
    return sum + price * line.qty;
  }, 0), [lines, products, currency]);

  function pick(product, unit = 'bottle') {
    const key = lineKey(product.id, unit);
    setPicked((current) => ({ ...current, [key]: (current[key] || 0) + 1 }));
  }

  function setQty(productId, unit, qty) {
    const key = lineKey(productId, unit);
    const next = Math.max(0, Math.floor(Number(qty) || 0));
    setPicked((current) => {
      if (next < 1) {
        const copy = { ...current };
        delete copy[key];
        return copy;
      }
      return { ...current, [key]: next };
    });
  }

  function resetForm() {
    setClient('');
    setContact('');
    setDueAt(todayInput());
    setPicked({});
  }

  async function submit(event) {
    event.preventDefault();
    if (lines.length === 0) return;
    const result = await saveLoan({
      client,
      contact,
      dueAt,
      lines,
    });
    if (!result?.error) {
      resetForm();
      setCreating(false);
    }
  }

  async function collect(loan) {
    const amount = pay[loan.id];
    const result = await payLoan(loan.id, amount);
    if (!result?.error) setPay((current) => ({ ...current, [loan.id]: '' }));
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('nav_loans')}</p>
          <h1>{t('loans_title')}</h1>
          <p className="hint">{t('loans_lead')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-gold" onClick={() => setCreating(true)}>{t('new_loan')}</button>
        </div>
      </header>

      {creating ? (
        <Modal title={t('new_loan')} onClose={() => { setCreating(false); resetForm(); }} closeLabel={t('close')} wide>
          <form className="stack" onSubmit={submit}>
            <div className="grid-2">
              <Field label={t('client')}>
                <input value={client} onChange={(event) => setClient(event.target.value)} placeholder={t('client_ph')} required />
              </Field>
              <Field label={t('contact')}>
                <input value={contact} onChange={(event) => setContact(event.target.value)} placeholder={t('contact_ph')} dir="ltr" />
              </Field>
              <Field label={t('due_on')}>
                <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} required />
              </Field>
              <div className="loan-estimate">
                <span>{t('amount_owed')}</span>
                <strong dir="ltr">{money(estimate)}</strong>
              </div>
            </div>

            <p className="hint">{t('loan_pick')}</p>
            {inStock.length === 0 ? (
              <p className="hint">{t('empty_sale_text')}</p>
            ) : (
              <ul className="loan-pick">
                {inStock.map((product) => {
                  const bottles = picked[lineKey(product.id, 'bottle')] || 0;
                  const portions = picked[lineKey(product.id, 'portion')] || 0;
                  const selected = bottles > 0 || portions > 0;
                  return (
                    <li key={product.id} className={selected ? 'on' : ''}>
                      <button
                        type="button"
                        className="loan-pick-hit"
                        disabled={product.stock < 1}
                        onClick={() => pick(product, 'bottle')}
                      >
                        <span className="shelf-photo">
                          {product.image ? <img src={assetUrl(product.image)} alt="" /> : null}
                        </span>
                        <span>
                          {product.brand ? <small className="p-brand">{product.brand}</small> : null}
                          <strong><bdi>{displayName(product, lang)}</bdi></strong>
                          <small dir="ltr">{money(product.sellPrice)}</small>
                        </span>
                        {bottles > 0 ? <b className="qty-badge">{bottles}</b> : null}
                      </button>
                      <div className="loan-pick-tools">
                        {bottles > 0 ? (
                          <label>
                            <span className="sr">{t('qty')}</span>
                            <input
                              inputMode="numeric"
                              value={bottles}
                              onChange={(event) => setQty(product.id, 'bottle', event.target.value)}
                            />
                          </label>
                        ) : null}
                        {canPortion(product) && portionPrice(product, currency) > 0 ? (
                          <button type="button" className="shelf-part" onClick={() => pick(product, 'portion')}>
                            {t('portion')}
                            {portions > 0 ? <b className="qty-badge">{portions}</b> : null}
                          </button>
                        ) : null}
                        {portions > 0 ? (
                          <label>
                            <span className="sr">{t('qty')}</span>
                            <input
                              inputMode="numeric"
                              value={portions}
                              onChange={(event) => setQty(product.id, 'portion', event.target.value)}
                            />
                          </label>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setCreating(false); resetForm(); }}>{t('cancel')}</button>
              <button type="submit" className="btn btn-gold" disabled={lines.length === 0}>{t('save_loan')}</button>
            </div>
          </form>
        </Modal>
      ) : null}

      <section className="folio">
        <article className="folio-hero">
          <p className="eyebrow">{t('outstanding')}</p>
          <p className="folio-num" dir="ltr">{money(loanOutstanding(rows))}</p>
          <p className="folio-sub">{t('collected')} · <bdi dir="ltr">{money(loanCollected(rows))}</bdi></p>
        </article>
        {rows.length === 0 ? (
          <EmptyState
            kind="loan"
            title={t('no_loans')}
            text={t('loans_lead')}
            action={<button type="button" className="btn btn-gold" onClick={() => setCreating(true)}>{t('new_loan')}</button>}
          />
        ) : (
          <ul className="folio-list">
            {rows.map((loan) => {
              const left = Math.max(0, Number(loan.total) - Number(loan.paid));
              const ratio = Number(loan.total) > 0 ? Number(loan.paid) / Number(loan.total) : 0;
              const label = loan.status === 'paid' ? 'settled' : loan.status === 'partial' ? 'partial' : 'pending';
              const day = formatDate(loan.dueAt, lang, { day: 'numeric' });
              const month = formatDate(loan.dueAt, lang, { month: 'short' });
              return (
                <li key={loan.id} className="folio-card">
                  <div className="folio-mark">
                    <b>{day}</b>
                    <small>{month}</small>
                  </div>
                  <div className="folio-main">
                    <div className="folio-top">
                      <div>
                        <em className={`status-pill ${loan.status}`}>{t(label)}</em>
                        <strong>{loan.client}</strong>
                        <p className="book-meta">
                          {loan.items.map((item) => saleLineName(item, lang)).join(' · ')}
                          {loan.contact ? ` · ${loan.contact}` : ''}
                        </p>
                      </div>
                      <b className="folio-amount" dir="ltr">{money(left)}</b>
                    </div>
                    <div className="book-progress">
                      <div className="book-progress-top">
                        <span>{t('loan_progress')}</span>
                        <em dir="ltr">{percent(ratio)}</em>
                      </div>
                      <Track ratio={ratio} />
                      <div className="book-progress-foot">
                        <span>{t('paid_of')} <bdi dir="ltr">{money(loan.paid)}</bdi></span>
                        <span>{t('amount_owed')} <bdi dir="ltr">{money(loan.total)}</bdi></span>
                      </div>
                    </div>
                    {loan.payments?.length ? (
                      <p className="book-meta">
                        {loan.payments.map((entry) => `${formatDate(entry.at, lang, { day: 'numeric', month: 'short' })} ${money(entry.amount)}`).join(' · ')}
                      </p>
                    ) : null}
                    {loan.status !== 'paid' ? (
                      <form className="book-pay" onSubmit={(event) => { event.preventDefault(); collect(loan); }}>
                        <input
                          inputMode="decimal"
                          value={pay[loan.id] || ''}
                          onChange={(event) => setPay((current) => ({ ...current, [loan.id]: event.target.value }))}
                          placeholder={t('amount')}
                          aria-label={t('record_payment')}
                          required
                        />
                        <button type="submit" className="btn btn-gold btn-sm">{t('record_payment')}</button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
