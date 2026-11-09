import { useEffect, useMemo, useRef, useState } from 'react';
import { displayName, parseMoney, productMeta, roundMoney, secondaryName } from '../format.js';
import { useStore } from '../store.jsx';
import { PageHead } from '../ui.jsx';

export function Sale() {
  const {
    t, lang, products, cart, currency, money, addToCart, setCartQty, removeCartLine, clearCart, sell, openNewProduct,
  } = useStore();
  const [query, setQuery] = useState('');
  const [discount, setDiscount] = useState('');
  const [client, setClient] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState('cash');
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return products
      .filter((product) => {
        if (!needle) return true;
        return [product.nameFr, product.nameAr, product.brand, product.ref].join(' ').toLowerCase().includes(needle);
      })
      .sort((a, b) => displayName(a, lang).localeCompare(displayName(b, lang), lang === 'ar' ? 'ar' : 'fr'));
  }, [products, query, lang]);

  const available = filtered.filter((product) => product.stock > 0);
  const gone = filtered.filter((product) => product.stock <= 0);
  const lines = cart.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return null;
    return { ...line, product, over: line.qty > product.stock };
  }).filter(Boolean);

  const subtotal = roundMoney(
    lines.filter((line) => !line.over).reduce((sum, line) => sum + line.product.sellPrice * line.qty, 0),
    currency,
  );
  const discountValue = roundMoney(parseMoney(discount || 0), currency);
  const discountTooHigh = discountValue > subtotal;
  const total = roundMoney(subtotal - (discountTooHigh ? 0 : discountValue), currency);
  const blocked = lines.length === 0 || lines.some((line) => line.over) || discountTooHigh;
  const articleCount = lines.reduce((sum, line) => sum + line.qty, 0);

  async function submit(event) {
    event.preventDefault();
    if (blocked) return;
    const result = await sell({
      lines: lines.map((line) => ({ productId: line.productId, qty: line.qty })),
      discount: discountValue,
      payment,
      client,
      note,
    });
    if (result?.sale) {
      setDiscount('');
      setClient('');
      setNote('');
      setPayment('cash');
    }
  }

  function onSearchKey(event) {
    if (event.key === 'Enter' && available.length === 1) {
      event.preventDefault();
      addToCart(available[0].id);
    }
  }

  if (products.length === 0) {
    return (
      <>
        <PageHead eyebrow={t('sale_sub')} title={t('nav_sale')} />
        <section className="empty">
          <h2>{t('empty_sale')}</h2>
          <p>{t('empty_sale_text')}</p>
          <div className="empty-actions">
            <button type="button" className="btn btn-gold" onClick={openNewProduct}>{t('add_product')}</button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow={t('sale_sub')} title={t('nav_sale')} />
      <div className="register">
        <section>
          <label className="search">
            <span className="sr">{t('search_sale')}</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKey}
              placeholder={t('search_sale')}
            />
          </label>
          <ul className="catalog">
            {[...available, ...gone].map((product) => {
              const inCart = cart.find((line) => line.productId === product.id)?.qty || 0;
              const secondary = secondaryName(product, lang);
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    className={`catalog-item${inCart ? ' in-cart' : ''}`}
                    disabled={product.stock < 1}
                    onClick={() => addToCart(product.id)}
                  >
                    <span>
                      {product.brand ? <small className="p-brand">{product.brand}</small> : null}
                      <h3><bdi>{displayName(product, lang)}</bdi></h3>
                      {secondary ? <em className="p-alt"><bdi>{secondary}</bdi></em> : null}
                      <small className="p-meta">{[productMeta(product, t, { short: true }), t(product.gender)].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="catalog-side">
                      <strong className="num" dir="ltr">{money(product.sellPrice)}</strong>
                      <small>{product.stock < 1 ? t('sold_out') : `${product.stock} ${t('remaining')}`}</small>
                      {inCart > 0 ? <b className="qty-badge" dir="ltr">{inCart}</b> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 ? <p className="hint">{t('no_products')}</p> : null}
        </section>

        <form className="board" onSubmit={submit}>
          <p className="eyebrow">{t('net')}</p>
          <p className="board-total" dir="ltr">{money(discountTooHigh ? subtotal : total)}</p>
          <p className="board-caption">
            {articleCount === 1 ? t('one_article') : t('today_units', { n: articleCount })}
            {discountValue > 0 && !discountTooHigh ? ` · ${t('discount')} ${money(discountValue)}` : ''}
          </p>
          {lines.length === 0 ? <p className="ticket-empty">{t('ticket_empty')}</p> : (
            <ul className="board-lines">
              {lines.map((line) => (
                <li key={line.productId}>
                  <div>
                    <strong><bdi>{displayName(line.product, lang)}</bdi></strong>
                    <small>{productMeta(line.product, t, { short: true })}</small>
                    {line.over ? <small className="warn">{t('no_stock')}</small> : null}
                    <div className="line-tools">
                      <div className="stepper">
                        <button type="button" onClick={() => setCartQty(line.productId, line.qty - 1)} aria-label="-">−</button>
                        <span dir="ltr">{line.qty}</span>
                        <button type="button" onClick={() => setCartQty(line.productId, line.qty + 1)} disabled={line.qty >= line.product.stock} aria-label="+">+</button>
                      </div>
                      <button type="button" className="linkish" onClick={() => removeCartLine(line.productId)}>{t('remove_line')}</button>
                    </div>
                  </div>
                  <div className="paper-line-price" dir="ltr">
                    <b>{money(line.product.sellPrice * line.qty)}</b>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="board-grid">
            <label className="paper-field">
              <span>{t('discount')}</span>
              <input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0" />
            </label>
            <div className="pills ink-pills">
              <button type="button" className="chip-ink" onClick={() => setDiscount(String(roundMoney(subtotal * 0.05, currency)))}>5%</button>
              <button type="button" className="chip-ink" onClick={() => setDiscount(String(roundMoney(subtotal * 0.1, currency)))}>10%</button>
            </div>
          </div>
          {discountTooHigh ? <p className="warn">{t('discount_bad')}</p> : null}
          <div className="board-grid">
            <label className="paper-field">
              <span>{t('client')} · {t('optional')}</span>
              <input value={client} onChange={(event) => setClient(event.target.value)} placeholder={t('client_ph')} />
            </label>
            <label className="paper-field">
              <span>{t('note')} · {t('optional')}</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('note_ph')} />
            </label>
          </div>
          <div className="pay" role="group" aria-label={t('payment')}>
            {['cash', 'card'].map((method) => (
              <button type="button" key={method} className={payment === method ? 'on' : ''} onClick={() => setPayment(method)}>
                {t(method)}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-gold btn-block" disabled={blocked}>{t('validate_sale')}</button>
          {lines.length > 0 ? (
            <button type="button" className="linkish center-link" onClick={clearCart}>{t('clear_ticket')}</button>
          ) : null}
        </form>
      </div>
    </>
  );
}
