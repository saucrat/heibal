import { useState } from 'react';
import { assetUrl } from '../api.js';
import { displayName, formatDate, secondaryName } from '../format.js';
import { arrivageReport } from '../logic.js';
import { EmptyState } from '../empty.jsx';
import { PhotoField, ProductModal, productToForm } from '../modals.jsx';
import { useStore } from '../store.jsx';
import { Choice, Confirm, Field } from '../ui.jsx';

const VOLUMES = ['30', '50', '100', '200'];
const CONCENTRATIONS = ['parfum', 'extrait', 'edp', 'edt', 'edc', 'oil', 'mist'];
const GENDERS = ['men', 'women', 'mixed'];

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function percent(ratio) {
  const value = Math.round((Number(ratio) || 0) * 1000) / 10;
  return Number.isInteger(value) ? `${value}%` : `${value}%`;
}

function Track({ ratio }) {
  const width = Math.max(0, Math.min(100, (Number(ratio) || 0) * 100));
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)}>
      <span style={{ width: `${width}%` }} />
    </div>
  );
}

const blankPerfume = {
  nameFr: '',
  nameAr: '',
  brand: '',
  ref: '',
  concentration: 'edp',
  volumeMl: '100',
  gender: 'mixed',
  sellPrice: '',
  portionSell: '',
  qty: '1',
  unitCost: '',
  minStock: '1',
  image: '',
};

function soldText(line) {
  const parts = [];
  if (line.soldBottles > 0) parts.push(String(line.soldBottles));
  if (line.soldPortions > 0) parts.push(`${line.soldPortions} × 10 ml`);
  return parts.join(' + ') || '0';
}

function leftText(line) {
  const parts = [String(line.sealed)];
  if (line.openMl > 0) parts.push(`${line.openMl} ml`);
  return parts.join(' + ');
}

export function Shipments() {
  const {
    t, lang, products, shipments, money, saveShipment, updateShipment, removeShipment,
    addShipmentPerfume, removeProduct, currency,
  } = useStore();
  const [view, setView] = useState('list');
  const [openId, setOpenId] = useState('');
  const [total, setTotal] = useState('');
  const [arrivedAt, setArrivedAt] = useState(todayInput);
  const [perfume, setPerfume] = useState(blankPerfume);
  const [sheet, setSheet] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingCharge, setPendingCharge] = useState(null);
  const rows = [...(shipments || [])].sort((a, b) => String(b.arrivedAt).localeCompare(String(a.arrivedAt)));
  const open = rows.find((row) => row.id === openId) || (shipments || []).find((row) => row.id === openId);

  function setField(key, value) {
    setPerfume((current) => ({ ...current, [key]: value }));
  }

  function openEdit(row) {
    setOpenId(row.id);
    setTotal(String(row.total || ''));
    setArrivedAt(String(row.arrivedAt || '').slice(0, 10) || todayInput());
    setView('edit');
  }

  async function submit(event) {
    event.preventDefault();
    const result = await saveShipment({ total, arrivedAt, lines: [] });
    if (!result?.error) {
      const created = result.state?.shipments?.[0];
      setTotal('');
      setArrivedAt(todayInput());
      if (created?.id) {
        setOpenId(created.id);
        setView('detail');
      } else setView('list');
    }
  }

  async function submitEdit(event) {
    event.preventDefault();
    if (!openId) return;
    const result = await updateShipment(openId, { total, arrivedAt });
    if (!result?.error) {
      setView('detail');
    }
  }

  async function submitPerfume(event) {
    event.preventDefault();
    if (!open) return;
    const result = await addShipmentPerfume(open.id, perfume);
    if (!result?.error) setPerfume(blankPerfume);
  }

  if (view === 'detail' && open) {
    const report = arrivageReport(open, products, currency);
    const when = formatDate(open.arrivedAt, lang, { day: 'numeric', month: 'long', year: 'numeric' });
    return (
      <>
        <header className="charge-mast">
          <div>
            <button type="button" className="back-pill" onClick={() => setView('list')}>{t('back_stock')}</button>
            <h1>{t('arrivage_of', { n: when })}</h1>
          </div>
        </header>
        <section className="charge-ledger">
          <div><span>{t('invested')}</span><strong><bdi dir="ltr">{money(report.invested)}</bdi></strong></div>
          <div><span>{t('perfume_cost')}</span><strong><bdi dir="ltr">{money(report.perfumeCost)}</bdi></strong></div>
          <div className="hot"><span>{t('charge_fee')}</span><strong><bdi dir="ltr">{money(report.charge)}</bdi></strong></div>
          <div><span>{t('qty_bought')}</span><strong><bdi dir="ltr">{report.bottles}</bdi></strong></div>
        </section>
        <section className="charge-progress">
          <article>
            <header>
              <h2>{t('recover_title')}</h2>
              <strong dir="ltr">{percent(report.recoverRatio)}</strong>
            </header>
            <Track ratio={report.recoverRatio} />
            <dl>
              <div><dt>{t('recover_done')}</dt><dd><bdi dir="ltr">{money(report.recovered)}</bdi></dd></div>
              <div><dt>{t('recover_left')}</dt><dd><bdi dir="ltr">{money(report.recoverLeft)}</bdi></dd></div>
            </dl>
          </article>
          <article>
            <header>
              <h2>{t('expect_title')}</h2>
              <strong dir="ltr">{percent(report.expectedRatio)}</strong>
            </header>
            <Track ratio={report.expectedRatio} />
            <dl>
              <div><dt>{t('expect_done')}</dt><dd><bdi dir="ltr">{money(report.recovered)}</bdi></dd></div>
              <div><dt>{t('expect_left')}</dt><dd><bdi dir="ltr">{money(report.expectedLeft)}</bdi></dd></div>
            </dl>
          </article>
        </section>
        <section className="charge-work">
          <section className="charge-catalog">
            <h2>{t('perfumes_in')}</h2>
            {report.lines.length === 0 ? <EmptyState kind="bottle" text={t('charge_empty')} compact /> : (
              <ul className="charge-cards">
                {report.lines.map((line, index) => {
                  const product = products.find((item) => item.id === line.productId);
                  return (
                  <li key={`${line.productId}-${index}`} className="charge-card">
                    <span className="shot">{line.image ? <img src={assetUrl(line.image)} alt="" /> : null}</span>
                    <div>
                      <div className="charge-card-top">
                        <div>
                          <strong><bdi>{displayName(line, lang)}</bdi></strong>
                          <em>{[secondaryName(line, lang), line.brand].filter(Boolean).join(' · ')}</em>
                        </div>
                        <div className="charge-card-actions">
                          {product ? (
                            <button type="button" onClick={() => setSheet(productToForm(product))}>{t('edit')}</button>
                          ) : null}
                          <button type="button" className="danger" onClick={() => setPendingDelete({ id: line.productId })}>{t('delete')}</button>
                        </div>
                      </div>
                      <div className="charge-stats">
                        <span>{t('qty_bought')}<b><bdi dir="ltr">{line.qty}</bdi></b></span>
                        <span>{t('qty_sold')}<b><bdi dir="ltr">{soldText(line)}</bdi></b></span>
                        <span>{t('qty_left')}<b><bdi dir="ltr">{leftText(line)}</bdi></b></span>
                        <span>{t('unit_cost')}<b><bdi dir="ltr">{money(line.unitCost)}</bdi></b></span>
                        <span>{t('sell_price')}<b><bdi dir="ltr">{money(line.sell)}</bdi></b></span>
                        <span>{t('revenue_made')}<b><bdi dir="ltr">{money(line.revenue)}</bdi></b></span>
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
          <form className="charge-form" onSubmit={submitPerfume}>
            <h2>{t('add_product')}</h2>
            <PhotoField image={perfume.image} onChange={(image) => setField('image', image)} />
            <div className="grid-2">
              <Field label={t('name_fr')}>
                <input value={perfume.nameFr} onChange={(event) => setField('nameFr', event.target.value)} required />
              </Field>
              <Field label={t('name_ar')}>
                <input value={perfume.nameAr} onChange={(event) => setField('nameAr', event.target.value)} dir="auto" required />
              </Field>
              <Field label={t('brand')}>
                <input value={perfume.brand} onChange={(event) => setField('brand', event.target.value)} required />
              </Field>
            </div>
            <Field label={t('concentration')}>
              <Choice
                ariaLabel={t('concentration')}
                value={perfume.concentration}
                onValueChange={(value) => setField('concentration', value)}
                options={CONCENTRATIONS.map((item) => ({ value: item, label: t(item) }))}
              />
            </Field>
            <Field label={t('volume')}>
              <Choice
                ariaLabel={t('volume')}
                value={perfume.volumeMl}
                onValueChange={(value) => setField('volumeMl', value)}
                options={VOLUMES.map((volume) => ({ value: volume, label: `${volume} ml` }))}
              />
            </Field>
            <Field label={t('gender')}>
              <Choice
                ariaLabel={t('gender')}
                value={perfume.gender}
                onValueChange={(value) => setField('gender', value)}
                options={GENDERS.map((item) => ({ value: item, label: t(item) }))}
              />
            </Field>
            <div className="grid-2">
              <Field label={t('sell_price')}>
                <input inputMode="decimal" value={perfume.sellPrice} onChange={(event) => setField('sellPrice', event.target.value)} required />
              </Field>
              <Field label={t('unit_cost')}>
                <input inputMode="decimal" value={perfume.unitCost} onChange={(event) => setField('unitCost', event.target.value)} required />
              </Field>
              <Field label={t('qty')}>
                <input inputMode="numeric" value={perfume.qty} onChange={(event) => setField('qty', event.target.value)} required />
              </Field>
              {perfume.volumeMl === '100' || perfume.volumeMl === '200' ? (
                <Field label={t('portion_price')} hint={t('portion_price_hint')}>
                  <input inputMode="decimal" value={perfume.portionSell} onChange={(event) => setField('portionSell', event.target.value)} required />
                </Field>
              ) : null}
            </div>
            <button type="submit" className="btn btn-gold">{t('add_product')}</button>
          </form>
        </section>
        {sheet ? (
          <ProductModal
            initial={sheet}
            onClose={() => setSheet(null)}
            onDelete={() => {
              setPendingDelete(sheet);
              setSheet(null);
            }}
          />
        ) : null}
        {pendingDelete?.id ? (
          <Confirm
            title={t('delete')}
            body={t('confirm_delete')}
            confirmLabel={t('yes_delete')}
            closeLabel={t('cancel')}
            danger
            onClose={() => setPendingDelete(null)}
            onConfirm={() => {
              removeProduct(pendingDelete.id);
              setPendingDelete(null);
            }}
          />
        ) : null}
      </>
    );
  }

  if (view === 'new' || (view === 'edit' && openId)) {
    return (
      <>
        <section className="charge-create">
          <form className="charge-sheet" onSubmit={view === 'edit' ? submitEdit : submit}>
            <button type="button" className="back-pill" onClick={() => setView(view === 'edit' ? 'detail' : 'list')}>{t('back_stock')}</button>
            <p className="eyebrow">{t('nav_shipments')}</p>
            <h1>{view === 'edit' ? t('edit_charge') : t('new_arrivage')}</h1>
            <label className="charge-amount">
              <span>{t('invested')}</span>
              <div>
                <input inputMode="decimal" value={total} onChange={(event) => setTotal(event.target.value)} required placeholder="0" />
                <b>{currency}</b>
              </div>
            </label>
            <Field label={t('spent_on')}>
              <input type="date" value={arrivedAt} onChange={(event) => setArrivedAt(event.target.value)} required />
            </Field>
            <button type="submit" className="btn btn-gold">{t('save_shipment')}</button>
          </form>
          <aside className="charge-aside">
            <hr />
            <p>{t('shipment_lead')}</p>
          </aside>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{t('nav_shipments')}</p>
          <h1>{t('stock_title')}</h1>
          <p className="hint">{t('stock_lead')}</p>
        </div>
        <button type="button" className="btn btn-gold" onClick={() => { setTotal(''); setArrivedAt(todayInput()); setView('new'); }}>{t('new_arrivage')}</button>
      </header>
      {rows.length === 0 ? (
        <EmptyState
          kind="crate"
          title={t('no_shipments')}
          text={t('stock_lead')}
          action={<button type="button" className="btn btn-gold" onClick={() => { setTotal(''); setArrivedAt(todayInput()); setView('new'); }}>{t('new_arrivage')}</button>}
        />
      ) : (
        <ul className="arrivage-list">
          {rows.map((row) => {
            const report = arrivageReport(row, products, currency);
            const day = formatDate(row.arrivedAt, lang, { day: 'numeric' });
            const month = formatDate(row.arrivedAt, lang, { month: 'long', year: 'numeric' });
            const faces = report.lines.filter((line) => line.image).slice(0, 4);
            return (
              <li key={row.id} className="arrivage-card">
                <button type="button" className="arrivage-open" onClick={() => { setOpenId(row.id); setView('detail'); }}>
                  <span className="arrivage-mark">
                    <b>{day}</b>
                    <small>{month}</small>
                  </span>
                  <span className="arrivage-main">
                    <span className="arrivage-kicker">{t('invested')}</span>
                    <strong><bdi dir="ltr">{money(report.invested)}</bdi></strong>
                    <span className="arrivage-sub">
                      <span>{t('charge_fee')} <bdi dir="ltr">{money(report.charge)}</bdi></span>
                      <span>{t('qty_bought')} <bdi dir="ltr">{report.bottles}</bdi></span>
                    </span>
                    <span className="arrivage-track">
                      <Track ratio={report.recoverRatio} />
                      <em dir="ltr">{percent(report.recoverRatio)}</em>
                    </span>
                  </span>
                  {faces.length > 0 ? (
                    <span className="arrivage-faces">
                      {faces.map((line) => <img key={line.productId} src={assetUrl(line.image)} alt="" />)}
                    </span>
                  ) : null}
                </button>
                <div className="arrivage-actions">
                  <button type="button" onClick={() => openEdit(row)}>{t('edit')}</button>
                  <button type="button" className="danger" onClick={() => setPendingCharge(row)}>{t('delete')}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pendingCharge ? (
        <Confirm
          title={t('delete')}
          body={t('confirm_delete_charge')}
          confirmLabel={t('yes_delete')}
          closeLabel={t('cancel')}
          danger
          onClose={() => setPendingCharge(null)}
          onConfirm={async () => {
            const id = pendingCharge.id;
            setPendingCharge(null);
            await removeShipment(id);
            if (openId === id) {
              setOpenId('');
              setView('list');
            }
          }}
        />
      ) : null}
    </>
  );
}
