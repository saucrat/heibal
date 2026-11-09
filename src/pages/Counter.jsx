import { useEffect, useMemo, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { assetUrl } from '../api.js';
import { displayName, parseMoney, productMeta, roundMoney, secondaryName } from '../format.js';
import { canPortion, isLow, maxPortions, portionPrice } from '../logic.js';
import { ProductModal, productToForm } from '../modals.jsx';
import { useStore } from '../store.jsx';
import { Confirm, Select } from '../ui.jsx';

export function Counter() {
  const {
    t, lang, products, cart, currency, money, productFilter, setProductFilter, intent, setIntent,
    addToCart, setCartQty, setCartUnit, removeCartLine, clearCart, sell, removeProduct, setPage,
  } = useStore();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [sort, setSort] = useState('name');
  const [discount, setDiscount] = useState('');
  const [client, setClient] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState('cash');
  const [sheet, setSheet] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!intent || intent === 'product') {
      if (intent === 'product') setIntent(null);
      return;
    }
    const product = products.find((item) => item.id === intent.id);
    if (!product) return;
    setSheet({ form: productToForm(product), start: intent.start || 'fiche' });
    setIntent(null);
  }, [intent, products, setIntent]);

  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );
  const stockCounts = useMemo(() => ({
    all: products.length,
    low: products.filter((product) => isLow(product)).length,
    out: products.filter((product) => product.stock === 0).length,
  }), [products]);
  const brandCounts = useMemo(() => {
    const counts = {};
    for (const product of products) {
      if (!product.brand) continue;
      counts[product.brand] = (counts[product.brand] || 0) + 1;
    }
    return counts;
  }, [products]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const collator = new Intl.Collator(lang === 'ar' ? 'ar' : 'fr', { sensitivity: 'base' });
    const list = products.filter((product) => {
      if (brand !== 'all' && product.brand !== brand) return false;
      if (productFilter === 'out' && product.stock !== 0) return false;
      if (productFilter === 'low' && !isLow(product)) return false;
      if (!needle) return true;
      return [product.nameFr, product.nameAr, product.brand, product.ref].join(' ').toLowerCase().includes(needle);
    });
    list.sort((a, b) => {
      if (sort === 'stock') return a.stock - b.stock;
      if (sort === 'price') return b.sellPrice - a.sellPrice;
      if (sort === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
      return collator.compare(displayName(a, lang), displayName(b, lang));
    });
    return list;
  }, [products, query, brand, productFilter, sort, lang]);

  const lines = cart.map((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return null;
    const unit = line.unit === 'portion' ? 'portion' : 'bottle';
    const bottles = cart.find((item) => item.productId === product.id && item.unit !== 'portion')?.qty || 0;
    const limit = unit === 'portion'
      ? maxPortions({ ...product, stock: Math.max(0, product.stock - bottles) })
      : product.stock;
    const price = unit === 'portion' ? portionPrice(product, currency) : product.sellPrice;
    return { ...line, unit, product, price, limit, over: line.qty > limit };
  }).filter(Boolean);

  const subtotal = roundMoney(
    lines.filter((line) => !line.over).reduce((sum, line) => sum + line.price * line.qty, 0),
    currency,
  );
  const discountValue = roundMoney(parseMoney(discount || 0), currency);
  const discountTooHigh = discountValue > subtotal;
  const total = roundMoney(subtotal - (discountTooHigh ? 0 : discountValue), currency);
  const blocked = lines.length === 0 || lines.some((line) => line.over) || discountTooHigh || !client.trim();
  const articleCount = lines.reduce((sum, line) => sum + line.qty, 0);

  function openSheet(product, start) {
    setSheet({ form: productToForm(product), start });
  }

  async function submit(event) {
    event.preventDefault();
    if (blocked) return;
    const result = await sell({
      lines: lines.map((line) => ({ productId: line.productId, qty: line.qty, unit: line.unit })),
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
    if (event.key !== 'Enter') return;
    const sellable = shown.filter((product) => product.stock > 0 || maxPortions(product) > 0);
    if (sellable.length === 1) {
      event.preventDefault();
      const hit = sellable[0];
      if (hit.stock > 0) addToCart(hit.id);
      else if (portionPrice(hit, currency) > 0) addToCart(hit.id, 1, 'portion');
      setQuery('');
    }
  }

  return (
    <>
      <div className="counter">
        <section className="shelf">
          <div className="shelf-tools">
            <div className="shelf-searchline">
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
              <Select
                ariaLabel={t('sort')}
                value={sort}
                onValueChange={setSort}
                options={[
                  { value: 'name', label: t('sort_name') },
                  { value: 'stock', label: t('sort_stock') },
                  { value: 'price', label: t('sort_price') },
                  { value: 'recent', label: t('sort_recent') },
                ]}
              />
            </div>
            <div className="shelf-filters">
              <div className="status-seg" role="listbox" aria-label={t('stock_view')}>
                {[
                  ['all', t('all')],
                  ['low', t('filter_low')],
                  ['out', t('filter_out')],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    role="option"
                    aria-selected={productFilter === value && brand === 'all'}
                    className={productFilter === value && brand === 'all' ? 'on' : ''}
                    onClick={() => {
                      setProductFilter(value);
                      setBrand('all');
                    }}
                  >
                    <span>{label}</span>
                    <b dir="ltr">{stockCounts[value]}</b>
                  </button>
                ))}
              </div>
              {brands.length > 0 ? (
                <div className="maison-index" role="listbox" aria-label={t('brand')}>
                  {brands.map((item) => (
                    <button
                      type="button"
                      key={item}
                      role="option"
                      aria-selected={brand === item}
                      className={brand === item ? 'on' : ''}
                      onClick={() => {
                        setProductFilter('all');
                        setBrand(brand === item ? 'all' : item);
                      }}
                    >
                      <span>{item}</span>
                      <b dir="ltr">{brandCounts[item]}</b>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {products.length === 0 ? (
            <div className="shelf-empty">
              <p>{t('empty_sale_text')}</p>
              <button type="button" className="btn btn-gold" onClick={() => setPage('shipments')}>{t('open_stock')}</button>
            </div>
          ) : shown.length === 0 ? (
            <p className="shelf-empty">{t('no_products')}</p>
          ) : (
            <ul className="shelf-list">
              {shown.map((product) => {
                const bottleInCart = cart.find((line) => line.productId === product.id && line.unit !== 'portion')?.qty || 0;
                const portionInCart = cart.find((line) => line.productId === product.id && line.unit === 'portion')?.qty || 0;
                const openMl = (product.openMl || []).reduce((sum, ml) => sum + ml, 0);
                const portionLimit = maxPortions({ ...product, stock: Math.max(0, product.stock - bottleInCart) });
                const status = product.stock === 0 ? 'out' : isLow(product) ? 'low' : 'ok';
                const secondary = secondaryName(product, lang);
                return (
                  <li key={product.id} className={bottleInCart || portionInCart ? 'in-cart' : ''}>
                    <button
                      type="button"
                      className="shelf-hit"
                      disabled={product.stock < 1}
                      onClick={() => addToCart(product.id)}
                    >
                      <span className="shelf-photo">
                        {product.image ? <img src={assetUrl(product.image)} alt="" /> : null}
                      </span>
                      <span>
                        {product.brand ? <small className="p-brand">{product.brand}</small> : null}
                        <strong><bdi>{displayName(product, lang)}</bdi></strong>
                        {secondary ? <em className="p-alt"><bdi>{secondary}</bdi></em> : null}
                        <small className="p-meta">{productMeta(product, t, { short: true })}</small>
                      </span>
                      <strong className="shelf-price num" dir="ltr">{money(product.sellPrice)}</strong>
                      <span className={`shelf-stock ${status}`} dir="ltr">
                        {product.stock}
                        {openMl > 0 ? <small>{t('open_ml', { n: openMl })}</small> : null}
                        {bottleInCart > 0 ? <b className="qty-badge">{bottleInCart}</b> : null}
                      </span>
                    </button>
                    <div className="shelf-actions">
                      {canPortion(product) ? (
                        <button
                          type="button"
                          className="shelf-part"
                          disabled={portionLimit < 1 || portionInCart >= portionLimit || !(portionPrice(product, currency) > 0)}
                          onClick={() => addToCart(product.id, 1, 'portion')}
                        >
                          {t('portion')}
                          {portionInCart > 0 ? <b className="qty-badge">{portionInCart}</b> : null}
                        </button>
                      ) : null}
                      <button type="button" className="shelf-open" aria-label={t('fiche')} onClick={() => openSheet(product, 'fiche')}>
                        <MoreHorizontal size={18} strokeWidth={1.75} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <form className="ticket" onSubmit={submit}>
          <p className="eyebrow">{t('net')}</p>
          <p className="ticket-total" dir="ltr">{money(lines.length === 0 || discountTooHigh ? subtotal : total)}</p>
          <p className="ticket-caption">
            {articleCount === 1 ? t('one_article') : t('today_units', { n: articleCount })}
            {discountValue > 0 && !discountTooHigh ? ` · ${money(discountValue)}` : ''}
          </p>
          {lines.length === 0 ? <p className="ticket-empty">{t('ticket_empty')}</p> : (
            <ul className="ticket-lines">
              {lines.map((line) => (
                <li key={`${line.productId}-${line.unit}`}>
                  {line.product.image ? <img className="ticket-photo" src={assetUrl(line.product.image)} alt="" /> : <span className="ticket-photo" />}
                  <div className="ticket-copy">
                    <strong><bdi>{displayName(line.product, lang)}</bdi></strong>
                    <small>{line.unit === 'portion' ? t('portion') : productMeta(line.product, t, { short: true })}</small>
                    {line.over ? <small className="warn">{t('no_stock')}</small> : null}
                  </div>
                  <b className="ticket-sum" dir="ltr">{money(line.price * line.qty)}</b>
                  {canPortion(line.product) ? (
                    <div className="ticket-part" role="group" aria-label={t('serve_as')}>
                      <button
                        type="button"
                        dir="ltr"
                        className={line.unit !== 'portion' ? 'on' : ''}
                        disabled={line.unit === 'portion' && line.product.stock < 1}
                        onClick={() => setCartUnit(line.productId, line.unit, 'bottle')}
                      >
                        <span>{t('bottle_unit')}</span>
                        <em>{money(line.product.sellPrice)}</em>
                      </button>
                      <button
                        type="button"
                        dir="ltr"
                        className={line.unit === 'portion' ? 'on' : ''}
                        onClick={() => setCartUnit(line.productId, line.unit, 'portion')}
                        disabled={!(portionPrice(line.product, currency) > 0)}
                      >
                        <span>{t('portion')}</span>
                        <em>{money(portionPrice(line.product, currency))}</em>
                      </button>
                    </div>
                  ) : null}
                  <div className="line-tools">
                    <div className="stepper">
                      <button type="button" onClick={() => setCartQty(line.productId, line.qty - 1, line.unit)} aria-label="-">−</button>
                      <span dir="ltr">{line.qty}</span>
                      <button type="button" onClick={() => setCartQty(line.productId, line.qty + 1, line.unit)} disabled={line.qty >= line.limit} aria-label="+">+</button>
                    </div>
                    <button type="button" className="linkish" onClick={() => removeCartLine(line.productId, line.unit)}>{t('remove_line')}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <label className="ticket-field">
            <span>{t('discount')}</span>
            <input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0" />
          </label>
          <div className="choice ticket-choice">
            <button type="button" onClick={() => setDiscount(String(roundMoney(subtotal * 0.05, currency)))}>5%</button>
            <button type="button" onClick={() => setDiscount(String(roundMoney(subtotal * 0.1, currency)))}>10%</button>
          </div>
          {discountTooHigh ? <p className="warn">{t('discount_bad')}</p> : null}
          <label className="ticket-field">
            <span>{t('client')}</span>
            <input value={client} onChange={(event) => setClient(event.target.value)} placeholder={t('client_ph')} required autoComplete="name" />
          </label>
          <label className="ticket-field">
            <span>{t('note')} · {t('optional')}</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={t('note_ph')} />
          </label>
          <div className="pay" role="group" aria-label={t('payment')}>
            {['cash', 'card'].map((method) => (
              <button type="button" key={method} className={payment === method ? 'on' : ''} onClick={() => setPayment(method)}>
                {t(method)}
              </button>
            ))}
          </div>
          <button type="submit" className="btn btn-gold btn-block" disabled={blocked}>{t('validate_sale')}</button>
          {lines.length > 0 ? (
            <button type="button" className="linkish ticket-clear" onClick={clearCart}>{t('clear_ticket')}</button>
          ) : null}
        </form>
      </div>

      {sheet ? (
        <ProductModal
          initial={sheet.form}
          start={sheet.start}
          onClose={() => setSheet(null)}
          onDelete={() => {
            setPendingDelete(sheet.form);
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
