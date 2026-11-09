function Art({ kind, tone = 'paper' }) {
  const ink = tone === 'ink';
  const stroke = ink ? '#f6f1ea' : '#141210';
  const faint = ink ? 'rgba(246,241,234,0.34)' : 'rgba(20,18,16,0.28)';
  const paper = ink ? '#3a342e' : '#fff';
  const wash = ink ? 'rgba(246,241,234,0.08)' : 'rgba(20,18,16,0.05)';
  const accent = '#e23b2a';

  return (
    <svg className="void-svg" viewBox="0 0 220 168" aria-hidden="true">
      <ellipse cx="110" cy="150" rx="52" ry="7" fill={wash} />
      <circle cx="110" cy="76" r="62" fill={paper} />
      <circle cx="110" cy="76" r="62" fill="none" stroke={faint} strokeWidth="1" />
      <g className="float" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'desk' ? (
          <>
            <path d="M68 120h84" stroke={faint} />
            <rect x="94" y="40" width="32" height="66" rx="12" fill={paper} />
            <path d="M104 30h12v12h-12z" />
            <rect x="100" y="22" width="20" height="10" rx="3" fill={accent} stroke={accent} />
            <path d="M102 78c8 5 12 5 18 0" stroke={accent} />
          </>
        ) : null}
        {kind === 'sales' ? (
          <>
            <path d="M86 34h48v78l-8-6-8 6-8-6-8 6-8-6-8 6V34z" fill={paper} />
            <path d="M98 50h24M98 60h18M98 70h22" stroke={faint} />
            <circle cx="122" cy="88" r="3" fill={accent} stroke={accent} />
          </>
        ) : null}
        {kind === 'calm' ? (
          <>
            <rect x="100" y="48" width="22" height="50" rx="8" fill={paper} />
            <path d="M106 40h10v10h-10z" />
            <rect x="104" y="33" width="14" height="8" rx="2" fill={accent} stroke={accent} />
            <circle cx="142" cy="96" r="14" fill={paper} />
            <path d="M135 96l5 5 9-10" stroke={accent} />
          </>
        ) : null}
        {kind === 'chart' ? (
          <>
            <path d="M62 118h96M62 118V38" stroke={faint} />
            <path d="M70 104c16-6 22-8 34-22 10-12 18-14 28-28" stroke={accent} />
            <path d="M132 54c8-6 14-8 22-6" stroke={faint} strokeDasharray="3 4" />
            <circle cx="132" cy="54" r="3.2" fill={accent} stroke={accent} />
          </>
        ) : null}
        {kind === 'shelf' ? (
          <>
            <path d="M58 112h104" />
            <path d="M70 112V96M150 112V96" stroke={faint} />
            <rect x="72" y="58" width="16" height="40" rx="6" fill={paper} />
            <rect x="102" y="52" width="16" height="46" rx="6" fill="none" stroke={faint} strokeDasharray="3 3" />
            <rect x="132" y="64" width="16" height="34" rx="6" fill={paper} />
            <path d="M76 50h8M136 56h8" />
            <rect x="74" y="44" width="12" height="6" rx="2" fill={accent} stroke={accent} />
          </>
        ) : null}
        {kind === 'search' ? (
          <>
            <rect x="78" y="52" width="22" height="48" rx="8" fill={paper} />
            <path d="M84 44h10v10H84z" />
            <circle cx="128" cy="78" r="22" fill={paper} />
            <path d="M144 94l16 16" stroke={accent} />
          </>
        ) : null}
        {kind === 'ticket' ? (
          <>
            <path d="M74 42h72v20a8 8 0 0 0 0 16v20a8 8 0 0 0 0 16v8H74v-8a8 8 0 0 0 0-16V78a8 8 0 0 0 0-16V42z" fill={paper} />
            <path d="M90 64h40M90 76h28M90 100h36" stroke={faint} />
            <circle cx="128" cy="112" r="3" fill={accent} stroke={accent} />
          </>
        ) : null}
        {kind === 'crate' ? (
          <>
            <path d="M68 78l42-18 42 18-42 16z" fill={paper} />
            <path d="M68 78v36l42 16V94M152 78v36" />
            <path d="M92 70c8 8 20 8 36 0" stroke={accent} />
            <path d="M104 62v-16M116 58v-18" stroke={faint} />
          </>
        ) : null}
        {kind === 'bottle' ? (
          <>
            <rect x="94" y="50" width="32" height="62" rx="12" fill={paper} />
            <path d="M104 38h12v14h-12z" />
            <rect x="100" y="28" width="20" height="11" rx="3" fill={accent} stroke={accent} />
            <path d="M104 86c8 6 12 6 20 0v20c-6 4-14 4-20 0z" fill={accent} stroke={accent} opacity="0.9" />
          </>
        ) : null}
        {kind === 'wallet' ? (
          <>
            <path d="M64 64h92v48c0 6-4 10-10 10H74c-6 0-10-4-10-10V64z" fill={paper} />
            <path d="M64 78h92" stroke={faint} />
            <circle cx="132" cy="96" r="16" fill={paper} />
            <path d="M132 88v16M124 96h16" stroke={accent} />
          </>
        ) : null}
        {kind === 'loan' ? (
          <>
            <circle cx="96" cy="84" r="26" fill={paper} />
            <circle cx="126" cy="72" r="26" fill={paper} />
            <path d="M126 58a26 26 0 0 1 18 32" stroke={accent} />
            <path d="M90 84h12M96 78v12" stroke={faint} />
          </>
        ) : null}
        {kind === 'journal' ? (
          <>
            <path d="M110 42v78" />
            <path d="M110 46c-14-10-32-10-44 2v68c14-10 30-10 44 2" fill={paper} />
            <path d="M110 46c14-10 32-10 44 2v68c-14-10-30-10-44 2" fill={paper} />
            <path d="M78 70h18M78 82h14M124 70h18M124 82h14" stroke={faint} />
            <path d="M110 42c6 8 6 16 0 22" stroke={accent} />
          </>
        ) : null}
        {kind === 'rank' ? (
          <>
            <path d="M58 120h104" stroke={faint} />
            <rect x="74" y="86" width="22" height="34" rx="4" fill={paper} />
            <rect x="100" y="58" width="22" height="62" rx="4" fill="none" strokeDasharray="3 3" />
            <rect x="126" y="74" width="22" height="46" rx="4" fill={paper} />
            <circle cx="111" cy="48" r="3" fill={accent} stroke={accent} />
          </>
        ) : null}
        {kind === 'brand' ? (
          <>
            <circle cx="110" cy="78" r="28" fill={paper} />
            <circle cx="110" cy="78" r="18" stroke={faint} />
            <path d="M110 66v24M102 74h16" stroke={accent} />
            <path d="M92 108c8 6 28 6 36 0" stroke={faint} />
          </>
        ) : null}
      </g>
    </svg>
  );
}

export function EmptyState({
  kind = 'desk',
  title,
  text,
  action,
  compact = false,
  tone = 'paper',
}) {
  return (
    <section className={`void${compact ? ' compact' : ''}${tone === 'ink' ? ' ink' : ''}`}>
      <Art kind={kind} tone={tone} />
      {title ? <h2>{title}</h2> : null}
      {text ? <p>{text}</p> : null}
      {action || null}
    </section>
  );
}
