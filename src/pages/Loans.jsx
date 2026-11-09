import { useState } from 'react';
import { displayName, formatDate, saleLineName } from '../format.js';
import { canPortion, dueReminders, loanOutstanding } from '../logic.js';
import { useStore } from '../store.jsx';
import { Field } from '../ui.jsx';

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

const blankLine = { productId: '', qty: '1', unit: 'bottle' };

export function Loans() {
  const { t, lang, products, loans, money, saveLoan, payLoan } = useStore();
  const [client, setClient] = useState('');
  const [contact, setContact] = useState('');
  const [dueAt, setDueAt] = useState(todayInput);
  const [total, setTotal] = useState('');
  const [lines, setLines] = useState([{ ...blankLine }]);
  const [pay, setPay] = useState({});
  const rows = loans || [];
  const reminders = dueReminders(rows);

  function setLine(index, key, value) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  }

  async function submit(event) {
    event.preventDefault();
    const result = await saveLoan({
      client,
      contact,
      dueAt,
      total,
      lines: lines.filter((line) => line.productId),
    });
    if (!result?.error) {
      setClient('');
      setContact('');
      setTotal('');
      setLines([{ ...blankLine }]);
      setDueAt(todayInput());
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
        <p className="eyebrow">{t('outstanding')} <strong dir="ltr">{money(loanOutstanding(rows))}</strong></p>
      </header>
      {reminders.length > 0 ? (
        <ul className="reminders">
          {reminders.map((loan) => (
            <li key={loan.id}>
              <strong>{loan.client}</strong>
              <span>{t('reminder_left', { n: money(loan.total - loan.paid) })}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <form className="panel book-form" onSubmit={submit}>
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
          <Field label={t('amount_owed')} hint={t('owed_hint')}>
            <input inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} />
          </Field>
        </div>
        <ul className="line-editor">
          {lines.map((line, index) => {
            const product = products.find((item) => item.id === line.productId);
            return (
              <li key={index}>
                <label>
                  <span>{t('add_line')}</span>
                  <select value={line.productId} onChange={(event) => setLine(index, 'productId', event.target.value)} required>
                    <option value="">{t('add_line')}</option>
                    {products.map((item) => (
                      <option key={item.id} value={item.id}>{displayName(item, lang)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>{t('qty')}</span>
                  <input inputMode="numeric" value={line.qty} onChange={(event) => setLine(index, 'qty', event.target.value)} required />
                </label>
                <label>
                  <span>{t('serve_as')}</span>
                  <select value={line.unit} onChange={(event) => setLine(index, 'unit', event.target.value)}>
                    <option value="bottle">{t('bottle_unit')}</option>
                    {product && canPortion(product) ? <option value="portion">{t('portion')}</option> : null}
                  </select>
                </label>
                {lines.length > 1 ? (
                  <button type="button" className="linkish" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>{t('delete')}</button>
                ) : <span />}
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-ghost" onClick={() => setLines((current) => [...current, { ...blankLine }])}>{t('add_line')}</button>
        <button type="submit" className="btn btn-gold">{t('save_loan')}</button>
      </form>
      {rows.length === 0 ? <p className="hint">{t('no_loans')}</p> : (
        <ul className="money-list">
          {rows.map((loan) => {
            const left = Math.max(0, loan.total - loan.paid);
            const label = loan.status === 'paid' ? 'settled' : loan.status === 'partial' ? 'partial' : 'pending';
            return (
              <li key={loan.id} className="loan-row">
                <div>
                  <strong>{loan.client}</strong>
                  <small>
                    {loan.items.map((item) => saleLineName(item, lang)).join(' · ')}
                    {loan.contact ? ` · ${loan.contact}` : ''}
                  </small>
                  <small>
                    {t('due_on')} {formatDate(loan.dueAt, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}
                    {t('remind_on')} {formatDate(loan.remindAt, lang, { day: 'numeric', month: 'short' })}
                  </small>
                  {loan.payments?.length ? (
                    <small>
                      {loan.payments.map((pay) => `${formatDate(pay.at, lang, { day: 'numeric', month: 'short' })} ${money(pay.amount)}`).join(' · ')}
                    </small>
                  ) : null}
                </div>
                <div className="loan-pay">
                  <b dir="ltr">{money(left)}</b>
                  <em className={`status-pill ${loan.status}`}>{t(label)}</em>
                  {loan.status !== 'paid' ? (
                    <form onSubmit={(event) => { event.preventDefault(); collect(loan); }}>
                      <input
                        inputMode="decimal"
                        value={pay[loan.id] || ''}
                        onChange={(event) => setPay((current) => ({ ...current, [loan.id]: event.target.value }))}
                        placeholder={t('amount')}
                        aria-label={t('record_payment')}
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
    </>
  );
}
