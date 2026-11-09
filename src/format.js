export function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = parseFloat(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function moneyDigits(currency) {
  if (currency === 'TND') return 3;
  if (currency === 'EUR') return 2;
  return 0;
}

export function roundMoney(value, currency) {
  const factor = 10 ** moneyDigits(currency);
  return Math.round((Number(value) || 0) * factor) / factor;
}

export function money(value, currency = 'MRU') {
  const digits = moneyDigits(currency);
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(roundMoney(value, currency));
  if (currency === 'EUR') return `${formatted} €`;
  return `${formatted} ${currency}`;
}

export function dayKey(input) {
  const date = input instanceof Date ? input : new Date(input);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfDay(input = new Date()) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function shiftDays(input, days) {
  const date = new Date(input);
  date.setDate(date.getDate() + days);
  return date;
}

export function isSameDay(iso, date = new Date()) {
  return dayKey(iso) === dayKey(date);
}

export function inPeriod(iso, period) {
  if (!period || period === 'all') return true;
  const days = Number(period);
  if (!Number.isFinite(days)) return true;
  const start = startOfDay(new Date());
  start.setDate(start.getDate() - (days - 1));
  return new Date(iso) >= start;
}

export function localeOf(lang) {
  return lang === 'ar' ? 'ar-MR-u-nu-latn' : 'fr-FR';
}

export function formatDate(input, lang, options) {
  return new Date(input).toLocaleDateString(localeOf(lang), options);
}

export function formatTime(input, lang) {
  return new Date(input).toLocaleTimeString(localeOf(lang), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function displayName(item, lang) {
  if (!item) return '';
  if (lang === 'ar') return item.nameAr || item.nameFr || '';
  return item.nameFr || item.nameAr || '';
}

export function secondaryName(item, lang) {
  if (!item) return '';
  const primary = displayName(item, lang);
  const other = lang === 'ar' ? item.nameFr : item.nameAr;
  return other && other !== primary ? other : '';
}

export function saleLineName(item, lang) {
  const name = `${displayName(item, lang)} ×${item.qty}`;
  return item.unit === 'portion' ? `${name} · 10 ml` : name;
}

export function productMeta(item, label, { short = false } = {}) {
  if (!item) return '';
  const concentration = item.concentration
    ? label(short ? `${item.concentration}_s` : item.concentration)
    : '';
  const volume = item.volumeMl ? `${item.volumeMl} ml` : '';
  return [item.brand, concentration, volume].filter(Boolean).join(' · ');
}

export function shortId(id) {
  return String(id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
}
