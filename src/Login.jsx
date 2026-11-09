import { useEffect, useState } from 'react';
import { tr } from './i18n.js';
import { useStore } from './store.jsx';

export function Login({ checking }) {
  const { login } = useStore();
  const [lang, setLang] = useState('fr');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = (key) => tr(lang, key);

  useEffect(() => {
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'fr';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = lang === 'ar' ? '7B Parfumes — السجل' : '7B Parfumes — Registre';
  }, [lang]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const result = await login(email, password);
    if (result?.error) setError(true);
    setBusy(false);
  }

  return (
    <div className="gate">
      <aside className="gate-cover">
        <p className="gate-mark" dir="ltr">7B</p>
        <p className="gate-name" dir="ltr">Parfumes</p>
        <hr className="gate-rule" />
        <p className="gate-sub">{t('app_sub')}</p>
      </aside>
      <form className="gate-form" onSubmit={submit}>
        <div className="lang" role="group" aria-label={t('language')}>
          <button type="button" className={lang === 'fr' ? 'on' : ''} onClick={() => setLang('fr')}>FR</button>
          <button type="button" className={lang === 'ar' ? 'on' : ''} onClick={() => setLang('ar')}>العربية</button>
        </div>
        <h1>{t('login_title')}</h1>
        <p className="gate-lead">{t('login_lead')}</p>
        <label className="gate-field">
          <span>{t('login_email')}</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={checking || busy}
            dir="ltr"
          />
        </label>
        <label className="gate-field">
          <span>{t('login_password')}</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={checking || busy}
          />
        </label>
        {error ? <p className="warn">{t('login_bad')}</p> : null}
        <button type="submit" className="btn btn-gold" disabled={checking || busy}>{t('login_submit')}</button>
      </form>
    </div>
  );
}
