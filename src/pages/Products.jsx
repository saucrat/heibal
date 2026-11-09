import { useEffect, useMemo, useState } from 'react';
import { displayName, productMeta, secondaryName } from '../format.js';
import { isLow } from '../logic.js';
import { ProductModal, blankProduct, productToForm } from '../modals.jsx';
import { useStore } from '../store.jsx';
import { Confirm, Menu, MenuItem, PageHead, Select } from '../ui.jsx';

export function Products() {
  const {
    t, lang, products, money, productFilter, setProductFilter, intent, setIntent, addToCart, removeProduct,
  } = useStore();
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [sort, setSort] = useState('name');
  const [sheet, setSheet] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (intent === 'product') {
      setSheet({ form: blankProduct, start: 'fiche' });
      setIntent(null);
    }
  }, [intent, setIntent]);

  const brands = useMemo(
    () => [...new Set(products.map((product) => product.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const collator = new Intl.Collator(lang === 'ar' ? 'ar' : 'fr', { sensitivity: 'base' });
    const list = products.filter((product) => {
      if (brand !== 'all' && product.brand !== brand) return false;
      if (productFilter === 'out' && product.stock !== 0) return false;
      if (productFilter === 'low' && !isLow(product)) return false;
      if (!needle) return true;
      return [product.nameFr, product.nameAr, product.brand, product.ref, product.concentration]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    list.sort((a, b) => {
      if (sort === 'stock') return a.stock - b.stock;
      if (sort === 'price') return b.sellPrice - a.sellPrice;
      if (sort === 'recent') return new Date(b.createdAt) - new Date(a.createdAt);
      return collator.compare(displayName(a, lang), displayName(b, lang));
    });
    return list;
  }, [products, query, brand, productFilter, sort, lang]);

  function openSheet(product, start) {
    setSheet({ form: productToForm(product), start });
  }

  return (
    <>
      <PageHead eyebrow={t('products_sub')} title={t('nav_products')}>
        <button type="button" className="btn btn-gold" onClick={() => setSheet({ form: blankProduct, start: 'fiche' })}>{t('add_product')}</button>
      </PageHead>

      <div className="toolbar">
        <label className="search">
          <span className="sr">{t('search_products')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('search_products')} />
        </label>
        <Select
          value={brand}
          onValueChange={setBrand}
          ariaLabel={t('brand')}
          options={[
            { value: 'all', label: t('brand_all') },
            ...brands.map((item) => ({ value: item, label: item })),
          ]}
        />
        <Select
          value={sort}
          onValueChange={setSort}
          ariaLabel={t('sort')}
          options={[
            { value: 'name', label: t('sort_name') },
            { value: 'stock', label: t('sort_stock') },
            { value: 'price', label: t('sort_price') },
            { value: 'recent', label: t('sort_recent') },
          ]}
        />
      </div>

      <div className="pills filter-row">
        {[['all', 'all'], ['low', 'filter_low'], ['out', 'filter_out']].map(([id, key]) => (
          <button type="button" key={id} className={productFilter === id ? 'chip on' : 'chip'} onClick={() => setProductFilter(id)}>
            {t(key)}
          </button>
        ))}
        <span className="result-count" dir="ltr">{shown.length}</span>
      </div>

      {shown.length === 0 ? (
        <section className="empty compact">
          <p>{products.length === 0 ? t('empty_text') : t('no_products')}</p>
          {products.length === 0 ? (
            <div className="empty-actions">
              <button type="button" className="btn btn-gold" onClick={() => setSheet({ form: blankProduct, start: 'fiche' })}>{t('first_perfume')}</button>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="panel desk-table">
          <div className="table-wrap">
            <table className="data inventory">
              <thead>
                <tr>
                  <th>{t('nav_products')}</th>
                  <th>{t('sell_price')}</th>
                  <th>{t('stock_now')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((product) => {
                  const status = product.stock === 0 ? 'out' : isLow(product) ? 'low' : 'ok';
                  const secondary = secondaryName(product, lang);
                  return (
                    <tr key={product.id} className="click-row" onClick={() => openSheet(product, 'fiche')}>
                      <td>
                        {product.brand ? <p className="p-brand">{product.brand}</p> : null}
                        <strong><bdi>{displayName(product, lang)}</bdi></strong>
                        {secondary ? <small className="p-alt"><bdi>{secondary}</bdi></small> : null}
                        <small className="p-meta">
                          {[productMeta(product, t, { short: true }), product.gender ? t(product.gender) : '', product.ref]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </td>
                      <td>
                        <strong className="num" dir="ltr">{money(product.sellPrice)}</strong>
                        {product.buyPrice > 0 ? <small className="muted" dir="ltr">{money(product.buyPrice)}</small> : null}
                      </td>
                      <td>
                        <strong className={`stock-num ${status}`} dir="ltr">{product.stock}</strong>
                        <small className={`pill pill-${status}`}>{t(status === 'ok' ? 'in_stock' : status)}</small>
                      </td>
                      <td className="row-end" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        <Menu label={t('actions')}>
                          <MenuItem disabled={product.stock < 1} onSelect={() => addToCart(product.id)}>{t('sell')}</MenuItem>
                          <MenuItem onSelect={() => openSheet(product, 'in')}>{t('restock')}</MenuItem>
                          <MenuItem disabled={product.stock < 1} onSelect={() => openSheet(product, 'out')}>{t('writeoff')}</MenuItem>
                          <MenuItem onSelect={() => openSheet(product, 'fiche')}>{t('edit')}</MenuItem>
                          <MenuItem danger onSelect={() => setPendingDelete(product)}>{t('delete')}</MenuItem>
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
      {pendingDelete ? (
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
