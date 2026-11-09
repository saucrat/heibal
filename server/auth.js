import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

const EMAIL = 'haibal@7b.com';
const SALT = Buffer.from('rGGTrvh8_IhKDDS-0dcvJw', 'base64url');
const PASSWORD_HASH = Buffer.from('Mi4uARLTJHstZ6NyThIFEUlGjckud58h0f27ArTb3Gk', 'base64url');
const SECRET = 'r7sxX8CpzAerPUcgu70HEW-pSH1hwXlCU1M2EjAph5U';
const COOKIE = '7b';
const WEEK = 14 * 24 * 60 * 60;

export function checkLogin(email, password) {
  const mail = String(email || '').trim().toLowerCase();
  const pass = String(password || '');
  if (pass.length < 1 || pass.length > 200) return false;
  const hash = scryptSync(pass, SALT, PASSWORD_HASH.length);
  const mailOk = mail.length === EMAIL.length && timingSafeEqual(Buffer.from(mail), Buffer.from(EMAIL));
  const passOk = hash.length === PASSWORD_HASH.length && timingSafeEqual(hash, PASSWORD_HASH);
  return mailOk && passOk;
}

function sign(exp) {
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function sessionToken() {
  return sign(Date.now() + WEEK * 1000);
}

export function readSession(req) {
  const header = req.headers.cookie || '';
  let token = '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${COOKIE}=`)) continue;
    token = trimmed.slice(COOKIE.length + 1);
  }
  const split = token.split('.');
  if (split.length !== 2) return false;
  const [payload, sig] = split;
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number(body.exp) > Date.now();
  } catch {
    return false;
  }
}

function cookieFlags() {
  if (process.env.NODE_ENV === 'production') {
    return 'HttpOnly; Secure; SameSite=None; Path=/';
  }
  return 'HttpOnly; SameSite=Lax; Path=/';
}

export function setSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=${sessionToken()}; ${cookieFlags()}; Max-Age=${WEEK}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; ${cookieFlags()}; Max-Age=0`);
}
