import { useState } from 'react';
import { formatDate } from '../format.js';
import { useStore } from '../store.jsx';
import { Choice, Field } from '../ui.jsx';

const CATEGORIES = ['', 'water', 'food', 'transport', 'packaging', 'other'];

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function Expenses() {
  const { t, lang, expenses, money, saveExpense, removeExpense } = useStore();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [spentAt, setSpentAt] = useState(todayInput);
  const rows = expenses || [];

  async function submit(event) {
    event.preventDefault();
    const result = await saveExpense({ amount, description, category, spentAt });
    if (!result?.error) {
      setAmount('');
      setDescription('');
      setCategory('');
      setSpentAt(todayInput());
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('nav_expenses')}</p>
          <h1>{t('expenses_title')}</h1>
          <p className="hint">{t('expenses_lead')}</p>
        </div>
      </header>
      <form className="panel book-form" onSubmit={submit}>
        <div className="grid-2">
          <Field label={t('amount')}>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </Field>
          <Field label={t('spent_on')}>
            <input type="date" value={spentAt} onChange={(event) => setSpentAt(event.target.value)} required />
          </Field>
        </div>
        <Field label={t('description')}>
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t('expense_ph')} required />
        </Field>
        <Field label={t('category')}>
          <Choice
            ariaLabel={t('category')}
            value={category}
            onValueChange={setCategory}
            options={CATEGORIES.map((item) => ({ value: item, label: item ? t(item) : t('category_none') }))}
          />
        </Field>
        <button type="submit" className="btn btn-gold">{t('add_expense')}</button>
      </form>
      {rows.length === 0 ? <p className="hint">{t('no_expenses')}</p> : (
        <ul className="money-list">
          {rows.map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.description}</strong>
                <small>
                  {formatDate(row.spentAt, lang, { day: 'numeric', month: 'short', year: 'numeric' })}
                  {row.category ? ` · ${t(row.category)}` : ''}
                </small>
              </div>
              <b dir="ltr">{money(row.amount)}</b>
              <button type="button" className="linkish" onClick={() => removeExpense(row.id)}>{t('delete')}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
