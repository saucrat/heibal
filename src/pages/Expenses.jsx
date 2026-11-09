import { useMemo, useState } from 'react';
import { formatDate } from '../format.js';
import { expenseTotal } from '../logic.js';
import { useStore } from '../store.jsx';
import { EmptyState } from '../empty.jsx';
import { Choice, Confirm, Field, Modal } from '../ui.jsx';

const CATEGORIES = ['', 'water', 'food', 'transport', 'packaging', 'other'];

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function Expenses() {
  const { t, lang, expenses, money, saveExpense, removeExpense } = useStore();
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [spentAt, setSpentAt] = useState(todayInput);
  const [pending, setPending] = useState(null);
  const rows = useMemo(
    () => [...(expenses || [])].sort((a, b) => String(b.spentAt).localeCompare(String(a.spentAt))),
    [expenses],
  );
  const total = expenseTotal(rows);

  async function submit(event) {
    event.preventDefault();
    const result = await saveExpense({ amount, description, category, spentAt });
    if (!result?.error) {
      setAmount('');
      setDescription('');
      setCategory('');
      setSpentAt(todayInput());
      setCreating(false);
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
        <div className="page-actions">
          <button type="button" className="btn btn-gold" onClick={() => setCreating(true)}>{t('new_expense')}</button>
        </div>
      </header>

      {creating ? (
        <Modal title={t('new_expense')} onClose={() => setCreating(false)} closeLabel={t('close')}>
          <form className="stack" onSubmit={submit}>
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
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>{t('cancel')}</button>
            <button type="submit" className="btn btn-gold">{t('add_expense')}</button>
          </div>
          </form>
        </Modal>
      ) : null}

      <section className="folio">
        <article className="folio-hero">
          <p className="eyebrow">{t('amount')}</p>
          <p className="folio-num" dir="ltr">{money(total)}</p>
          <p className="folio-sub">{rows.length}</p>
        </article>
        {rows.length === 0 ? (
          <EmptyState
            kind="wallet"
            title={t('no_expenses')}
            text={t('expenses_lead')}
            action={<button type="button" className="btn btn-gold" onClick={() => setCreating(true)}>{t('new_expense')}</button>}
          />
        ) : (
          <ul className="folio-list">
            {rows.map((row) => {
              const day = formatDate(row.spentAt, lang, { day: 'numeric' });
              const month = formatDate(row.spentAt, lang, { month: 'short', year: 'numeric' });
              return (
                <li key={row.id} className="folio-card">
                  <div className="folio-mark">
                    <b>{day}</b>
                    <small>{month}</small>
                  </div>
                  <div className="folio-main">
                    <div className="folio-top">
                      <div>
                        {row.category ? <em className="status-pill">{t(row.category)}</em> : null}
                        <strong>{row.description}</strong>
                      </div>
                      <b className="folio-amount" dir="ltr">{money(row.amount)}</b>
                    </div>
                    <button type="button" className="linkish" onClick={() => setPending(row)}>{t('delete')}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {pending ? (
        <Confirm
          title={t('delete')}
          body={pending.description}
          confirmLabel={t('yes_delete')}
          closeLabel={t('cancel')}
          danger
          onClose={() => setPending(null)}
          onConfirm={() => {
            removeExpense(pending.id);
            setPending(null);
          }}
        />
      ) : null}
    </>
  );
}
