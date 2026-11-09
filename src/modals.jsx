import { useState } from 'react';
import { assetUrl } from './api.js';
import { displayName, parseMoney } from './format.js';
import { uploadPhoto } from './media.js';
import { canPortion, maxPortions, portionPrice } from './logic.js';
import { useStore } from './store.jsx';
import { Choice, Field, Modal } from './ui.jsx';

const CONCENTRATIONS = ['parfum', 'extrait', 'edp', 'edt', 'edc', 'oil', 'mist'];
const GENDERS = ['men', 'women', 'mixed'];
const VOLUMES = ['30', '50', '100', '200'];
const REASONS = ['tester', 'gift', 'loss', 'inventory', 'other'];

export const blankProduct = {
  id: null,
  nameFr: '',
  nameAr: '',
  brand: '',
  ref: '',
  concentration: 'edp',
  volumeMl: '100',
  gender: 'mixed',
  buyPrice: '',
  sellPrice: '',
  stock: '1',
  minStock: '1',
  image: '',
  portionSell: '',
};

export function productToForm(product) {
  return {
    id: product.id,
    nameFr: product.nameFr,
    nameAr: product.nameAr,
    brand: product.brand,
    ref: product.ref,
    concentration: product.concentration || 'edp',
    volumeMl: product.volumeMl == null || product.volumeMl === '' ? '' : String(product.volumeMl),
    gender: product.gender || 'mixed',
    buyPrice: product.buyPrice ? String(product.buyPrice) : '',
    sellPrice: String(product.sellPrice ?? ''),
    stock: String(product.stock ?? 0),
    minStock: String(product.minStock ?? 0),
    image: product.image || '',
    portionSell: product.portionSell ? String(product.portionSell) : '',
  };
}

export function PhotoField({ image, onChange, invalid = false }) {
  const { t } = useStore();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setFailed(false);
    try {
      onChange(await uploadPhoto(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`photo-field${invalid ? ' invalid' : ''}`}>
      <div className="photo-frame">
        {image ? <img src={assetUrl(image)} alt="" /> : <span>{t('photo_empty')}</span>}
      </div>
      <div className="photo-actions">
        <label className={`btn btn-ghost file-btn${busy ? ' is-busy' : ''}`}>
          {busy ? t('photo_busy') : image ? t('photo_change') : t('photo_add')}
          <input type="file" accept="image/*" hidden disabled={busy} onChange={pick} />
        </label>
        {image ? (
          <button type="button" className="linkish" onClick={() => onChange('')}>{t('photo_remove')}</button>
        ) : null}
        {failed ? <small className="warn">{t('photo_error')}</small> : null}
      </div>
    </div>
  );
}

function QtyStep({ value, onChange, min = 1 }) {
  const current = Math.max(0, Math.floor(Number(value) || 0));
  return (
    <div className="stepper stepper-lg">
      <button type="button" onClick={() => onChange(String(Math.max(min, current - 1)))} aria-label="-">−</button>
      <input inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" onClick={() => onChange(String(current + 1))} aria-label="+">+</button>
    </div>
  );
}

export function ProductModal({ initial, start = 'fiche', onClose, onDelete }) {
  const { t, lang, money, currency, products, saveProduct, addToCart, writeoff } = useStore();
  const [form, setForm] = useState(initial);
  const [mode, setMode] = useState(start === 'in' ? 'fiche' : start);
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('tester');
  const [note, setNote] = useState('');
  const [gaps, setGaps] = useState([]);
  const editing = Boolean(initial.id);
  const live = products.find((item) => item.id === initial.id);
  const stock = live?.stock ?? (Number(initial.stock) || 0);
  const portions = live ? maxPortions(live) : 0;

  function set(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function missingFields() {
    const missing = [];
    if (!form.nameFr.trim()) missing.push('nameFr');
    if (!form.nameAr.trim()) missing.push('nameAr');
    if (!form.brand.trim()) missing.push('brand');
    if (!(Number(form.volumeMl) > 0)) missing.push('volumeMl');
    if (!(parseMoney(form.sellPrice) > 0)) missing.push('sellPrice');
    if (!(parseMoney(form.buyPrice) > 0)) missing.push('buyPrice');
    if ((String(form.volumeMl) === '100' || String(form.volumeMl) === '200') && !(parseMoney(form.portionSell) > 0)) missing.push('portionSell');
    if (!editing && String(form.stock).trim() === '') missing.push('stock');
    if (String(form.minStock).trim() === '') missing.push('minStock');
    if (!form.image) missing.push('image');
    return missing;
  }

  async function submit(event) {
    event.preventDefault();
    const missing = missingFields();
    setGaps(missing);
    if (missing.length) return;
    const result = await saveProduct(form);
    if (!result?.error) onClose();
  }

  async function submitWriteoff(event) {
    event.preventDefault();
    const result = await writeoff({ productId: initial.id, qty, reason, note });
    if (!result?.error) onClose();
  }

  const modes = [
    ['fiche', 'fiche'],
    ['out', 'writeoff'],
  ];

  return (
    <Modal
      sheet
      title={editing ? t('edit_product') : t('new_product')}
      onClose={onClose}
      closeLabel={t('close')}
    >
      {editing ? (
        <div className="sheet-hero">
          <PhotoField image={form.image || ''} invalid={gaps.includes('image')} onChange={(image) => set('image', image)} />
          <div>
            {form.brand ? <p className="p-brand">{form.brand}</p> : null}
            <h3><bdi>{displayName(form, lang) || t('new_product')}</bdi></h3>
            {form.nameAr && lang !== 'ar' ? <p className="p-alt"><bdi>{form.nameAr}</bdi></p> : null}
            {form.nameFr && lang === 'ar' ? <p className="p-alt"><bdi>{form.nameFr}</bdi></p> : null}
          </div>
          <div className="sheet-stock">
            <strong dir="ltr">{stock}</strong>
            <span dir="ltr">{money(Number(form.sellPrice) || 0)}</span>
          </div>
        </div>
      ) : (
        <PhotoField image={form.image || ''} invalid={gaps.includes('image')} onChange={(image) => set('image', image)} />
      )}

      {editing ? (
        <div className="segment" role="tablist">
          {modes.map(([id, key]) => (
            <button
              type="button"
              key={id}
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? 'on' : ''}
              onClick={() => setMode(id)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      ) : null}

      {mode === 'out' && editing ? (
        <form className="stack sheet-form" onSubmit={submitWriteoff}>
          <p className="hint">{t('available')} · <span dir="ltr">{stock}</span></p>
          <Field label={t('qty')}>
            <QtyStep value={qty} onChange={setQty} />
          </Field>
          <Field label={t('reason')}>
            <Choice
              value={reason}
              onValueChange={setReason}
              ariaLabel={t('reason')}
              options={REASONS.map((item) => ({ value: item, label: t(item) }))}
            />
          </Field>
          <Field label={t('note')}>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('note_ph')} />
          </Field>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn btn-gold">{t('save')}</button>
          </div>
        </form>
      ) : null}

      {mode === 'fiche' ? (
        <form className="stack sheet-form" onSubmit={submit}>
          {editing ? (
            <button
              type="button"
              className="btn btn-gold btn-block"
              disabled={(stock < 1 && portions < 1) || (stock < 1 && portionPrice(live, currency) <= 0)}
              onClick={() => {
                if (stock > 0) addToCart(initial.id);
                else if (portionPrice(live, currency) > 0) addToCart(initial.id, 1, 'portion');
                onClose();
              }}
            >
              {t('to_register')}
            </button>
          ) : <p className="hint">{t('name_hint')}</p>}
          {gaps.length ? <p className="warn">{t('required_fields')}</p> : null}
          <div className="grid-2">
            <Field label={t('name_fr')} invalid={gaps.includes('nameFr')}>
              <input value={form.nameFr} onChange={(event) => set('nameFr', event.target.value)} placeholder={t('name_ph')} required />
            </Field>
            <Field label={t('name_ar')} invalid={gaps.includes('nameAr')}>
              <input value={form.nameAr} onChange={(event) => set('nameAr', event.target.value)} placeholder={t('name_ar_ph')} dir="auto" required />
            </Field>
            <Field label={t('brand')} invalid={gaps.includes('brand')}>
              <input value={form.brand} onChange={(event) => set('brand', event.target.value)} placeholder={t('brand_ph')} required />
            </Field>
          </div>
          <Field label={t('concentration')}>
            <Choice
              value={form.concentration}
              onValueChange={(value) => set('concentration', value)}
              ariaLabel={t('concentration')}
              options={CONCENTRATIONS.map((item) => ({ value: item, label: t(item) }))}
            />
          </Field>
          <Field label={t('volume')} invalid={gaps.includes('volumeMl')}>
            <Choice
              value={String(form.volumeMl)}
              onValueChange={(value) => set('volumeMl', value)}
              ariaLabel={t('volume')}
              options={VOLUMES.map((volume) => ({ value: volume, label: `${volume} ml` }))}
            />
            <input inputMode="numeric" value={form.volumeMl} onChange={(event) => set('volumeMl', event.target.value)} required />
          </Field>
          <Field label={t('gender')}>
            <Choice
              value={form.gender}
              onValueChange={(value) => set('gender', value)}
              ariaLabel={t('gender')}
              options={GENDERS.map((item) => ({ value: item, label: t(item) }))}
            />
          </Field>
          <div className="grid-2">
            <Field label={t('sell_price')} invalid={gaps.includes('sellPrice')}>
              <input inputMode="decimal" value={form.sellPrice} onChange={(event) => set('sellPrice', event.target.value)} required />
            </Field>
            {String(form.volumeMl) === '100' || String(form.volumeMl) === '200' ? (
              <Field label={t('portion_price')} hint={t('portion_price_hint')} invalid={gaps.includes('portionSell')}>
                <input inputMode="decimal" value={form.portionSell} onChange={(event) => set('portionSell', event.target.value)} required />
              </Field>
            ) : null}
            {editing ? (
              <div className="field span-2">
                <span>{t('stock_now')}</span>
                <strong className="stock-read" dir="ltr">{initial.stock}</strong>
                <small>{t('stock_help')}</small>
              </div>
            ) : (
              <Field label={t('initial_qty')} hint={t('initial_hint')} invalid={gaps.includes('stock')}>
                <input inputMode="numeric" value={form.stock} onChange={(event) => set('stock', event.target.value)} required />
              </Field>
            )}
            <Field label={t('min_stock')} hint={t('seuil_hint')} invalid={gaps.includes('minStock')}>
              <input inputMode="numeric" value={form.minStock} onChange={(event) => set('minStock', event.target.value)} required />
            </Field>
          </div>
          <div className="modal-actions spread">
            {editing ? (
              <button type="button" className="btn btn-danger" onClick={onDelete}>{t('delete')}</button>
            ) : <span />}
            <div className="page-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
              <button type="submit" className="btn btn-gold">{t('save')}</button>
            </div>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}

export function RestockModal({ product, onClose }) {
  const { t, lang, restock } = useStore();
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [note, setNote] = useState('');

  async function submit(event) {
    event.preventDefault();
    const result = await restock({ productId: product.id, qty, unitCost, note });
    if (!result?.error) onClose();
  }

  return (
    <Modal title={t('restock_title')} onClose={onClose} closeLabel={t('close')}>
      <form className="stack" onSubmit={submit}>
        <p className="picked"><bdi>{displayName(product, lang)}</bdi></p>
        <Field label={t('qty')}>
          <QtyStep value={qty} onChange={setQty} />
        </Field>
        <Field label={t('cost_unit')} hint={t('update_cost_hint')}>
          <input inputMode="decimal" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} required />
        </Field>
        <Field label={t('note')}>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('note_ph')} />
        </Field>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className="btn btn-gold">{t('save')}</button>
        </div>
      </form>
    </Modal>
  );
}

function PinModal({ title, body, confirmLabel, danger = false, onClose, onConfirm, onSuccess }) {
  const { t } = useStore();
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const result = await onConfirm(pin);
    setBusy(false);
    if (result?.error === 'bad_pin' || result?.error === 'forbidden') {
      setPinError(true);
      return;
    }
    if (!result?.error) {
      onClose();
      onSuccess?.();
    }
  }

  return (
    <Modal title={title} onClose={onClose} closeLabel={t('close')}>
      <form className="stack" onSubmit={submit}>
        <p className="confirm-text">{body}</p>
        <Field label={t('delete_pin')} invalid={pinError}>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => { setPin(event.target.value); setPinError(false); }}
            placeholder="••••••"
            autoComplete="off"
            autoFocus
            required
          />
        </Field>
        {pinError ? <p className="warn">{t('bad_pin')}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`} disabled={!pin.trim() || busy}>{confirmLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

export function SettingsModal({ onClose }) {
  const { t, currency, setCurrency, exportData, importData, resetData, confirmPin } = useStore();
  const [gate, setGate] = useState(null);
  const [file, setFile] = useState(null);
  const codes = ['MRU', 'EUR', 'MAD', 'TND', 'DA'];

  function closeGate() {
    setGate(null);
    setFile(null);
  }

  return (
    <>
      <Modal title={t('settings')} onClose={onClose} closeLabel={t('close')}>
        <div className="stack">
          <p className="hint">{t('settings_lead')}</p>
          <Field label={t('currency')} hint={t('currency_note')}>
            <Choice
              value={currency}
              onValueChange={setCurrency}
              ariaLabel={t('currency')}
              options={codes.map((code) => ({ value: code, label: code }))}
            />
          </Field>
          <section className="setting-block">
            <h3>{t('backup')}</h3>
            <p className="hint">{t('export_lead')}</p>
            <button type="button" className="btn btn-ghost" onClick={() => setGate('export')}>{t('export')}</button>
            <p className="hint">{t('import_lead')}</p>
            <label className="btn btn-ghost file-btn">
              {t('import')}
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const next = event.target.files?.[0];
                  if (next) {
                    setFile(next);
                    setGate('import');
                  }
                  event.target.value = '';
                }}
              />
            </label>
          </section>
          <section className="setting-block danger-block">
            <h3>{t('danger_zone')}</h3>
            <p className="hint">{t('reset_lead')}</p>
            <button type="button" className="btn btn-danger" onClick={() => setGate('reset')}>{t('reset')}</button>
          </section>
        </div>
      </Modal>
      {gate === 'export' ? (
        <PinModal
          title={t('export')}
          body={t('pin_export')}
          confirmLabel={t('export')}
          onClose={closeGate}
          onConfirm={async (pin) => {
            const result = await confirmPin(pin);
            if (!result?.error && result?.ok) exportData();
            return result?.ok ? { ok: true } : result;
          }}
        />
      ) : null}
      {gate === 'import' && file ? (
        <PinModal
          title={t('import')}
          body={t('pin_import')}
          confirmLabel={t('import')}
          onClose={closeGate}
          onConfirm={(pin) => importData(file, pin)}
        />
      ) : null}
      {gate === 'reset' ? (
        <PinModal
          title={t('reset')}
          body={t('reset_confirm')}
          confirmLabel={t('yes_reset')}
          danger
          onClose={closeGate}
          onSuccess={onClose}
          onConfirm={(pin) => resetData(pin)}
        />
      ) : null}
    </>
  );
}
