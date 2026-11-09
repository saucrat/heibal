import { assetUrl } from './api.js';
import { displayName, formatDate, formatTime, money, productMeta, shortId } from './format.js';
import { useStore } from './store.jsx';

export function PaperBrand() {
  const { t } = useStore();
  return (
    <header className="paper-head">
      <p className="mark" dir="ltr">7B</p>
      <p className="maison" dir="ltr">PARFUMES</p>
      <p className="sub">{t('maison')}</p>
    </header>
  );
}

export function Receipt({ sale }) {
  const { t, lang, currency, products } = useStore();
  return (
    <article className="paper receipt-print">
      <PaperBrand />
      <hr className="dashed" />
      <p className="paper-meta">
        <span>{formatDate(sale.createdAt, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span dir="ltr">{formatTime(sale.createdAt, lang)}</span>
      </p>
      <p className="paper-meta">
        <span>{t('ticket_no')}</span>
        <span dir="ltr">{shortId(sale.id)}</span>
      </p>
      {sale.client ? (
        <p className="paper-meta">
          <span>{t('client')}</span>
          <bdi>{sale.client}</bdi>
        </p>
      ) : null}
      <hr className="dashed" />
      <ul className="paper-lines">
        {sale.items.map((item) => (
          <li key={item.productId}>
            {products.find((product) => product.id === item.productId)?.image ? (
              <img className="paper-photo" src={assetUrl(products.find((product) => product.id === item.productId).image)} alt="" />
            ) : null}
            <div>
              <strong><bdi>{displayName(item, lang)}</bdi></strong>
              <small>{productMeta(item, t, { short: true })}</small>
            </div>
            <div className="paper-line-price" dir="ltr">
              <span>{item.qty} × {money(item.unitPrice, currency)}</span>
              <b>{money(item.lineTotal, currency)}</b>
            </div>
          </li>
        ))}
      </ul>
      <hr className="dashed" />
      <p className="paper-meta">
        <span>{t('subtotal')}</span>
        <span dir="ltr">{money(sale.subtotal, currency)}</span>
      </p>
      {sale.discount > 0 ? (
        <p className="paper-meta">
          <span>{t('discount')}</span>
          <span dir="ltr">− {money(sale.discount, currency)}</span>
        </p>
      ) : null}
      <p className="paper-meta total-row">
        <span>{t('net')}</span>
        <strong dir="ltr">{money(sale.total, currency)}</strong>
      </p>
      <p className="paper-meta">
        <span>{t('payment')}</span>
        <span>{t(sale.payment)}</span>
      </p>
      {sale.status === 'refunded' ? <p className="paper-flag">{t('refunded')}</p> : null}
      <p className="thanks">{t('print_thanks')}</p>
    </article>
  );
}
