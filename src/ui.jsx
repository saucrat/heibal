import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, MoreHorizontal, X } from 'lucide-react';
import { useId } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { assetUrl } from './api.js';

export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </div>
  );
}

export function Field({ label, hint, children, className = '', invalid = false }) {
  return (
    <div className={`field${invalid ? ' invalid' : ''} ${className}`.trim()}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function PerfumePhotos({ images }) {
  const list = [...new Set(images.filter(Boolean))].slice(0, 3);
  if (!list.length) return null;
  return (
    <span className="move-photos">
      {list.map((src) => <img key={src} src={assetUrl(src)} alt="" />)}
    </span>
  );
}

export function Select({ value, onValueChange, options, ariaLabel, placeholder }) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className="select-trigger" aria-label={ariaLabel}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="select-chevron">
          <ChevronDown size={16} strokeWidth={1.75} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="select-content" position="popper" sideOffset={8}>
          <SelectPrimitive.Viewport className="select-viewport">
            {options.map((item) => (
              <SelectPrimitive.Item key={item.value} value={item.value} className="select-item">
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check size={15} strokeWidth={2} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export function Choice({ value, onValueChange, options, ariaLabel }) {
  return (
    <div className="choice" role="listbox" aria-label={ariaLabel}>
      {options.map((item) => (
        <button
          type="button"
          key={item.value}
          role="option"
          aria-selected={value === item.value}
          className={value === item.value ? 'on' : ''}
          onClick={() => onValueChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Menu({ label, children }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="icon-btn" aria-label={label}>
        <MoreHorizontal size={18} strokeWidth={1.75} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="menu-content" align="end" sideOffset={8}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({ onSelect, disabled = false, danger = false, children }) {
  return (
    <DropdownMenu.Item className={`menu-item${danger ? ' danger' : ''}`} disabled={disabled} onSelect={onSelect}>
      {children}
    </DropdownMenu.Item>
  );
}

export function Modal({ title, onClose, children, wide = false, sheet = false, closeLabel = 'Close' }) {
  const describedBy = useId();
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-back" />
        <Dialog.Content
          className={`modal${wide ? ' wide' : ''}${sheet ? ' sheet' : ''}`}
          aria-describedby={describedBy}
          onInteractOutside={(event) => {
            const target = event.target;
            if (target instanceof Element && target.closest('[data-radix-popper-content-wrapper]')) {
              event.preventDefault();
            }
          }}
        >
          <div className="modal-head no-print">
            <Dialog.Title asChild>
              <h2>{title}</h2>
            </Dialog.Title>
            <Dialog.Close className="icon-btn" aria-label={closeLabel}>
              <X size={16} strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <Dialog.Description id={describedBy} className="sr">{title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ChartTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tip">
      <span>{row.title}</span>
      <strong dir="ltr">{row.display}</strong>
    </div>
  );
}

function TodayDot({ cx, cy, payload }) {
  if (!payload?.today || cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r="4.5" fill="#e23b2a" stroke="#ffffff" strokeWidth="2" />;
}

export function Chart({ rows, empty }) {
  const gradientId = useId().replace(/:/g, '');
  const max = Math.max(...rows.map((row) => row.value), 0);
  if (!rows.length || max <= 0) return <p className="hint">{empty}</p>;
  return (
    <div className="chart-box" dir="ltr">
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e23b2a" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#e23b2a" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            minTickGap={22}
            tick={{ fill: '#8a847a', fontSize: 12, fontFamily: 'Manrope, sans-serif' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={[0, 'dataMax']} />
          <Tooltip cursor={{ stroke: '#e23b2a', strokeWidth: 1, strokeDasharray: '3 3' }} content={<ChartTip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#e23b2a"
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={<TodayDot />}
            activeDot={{ r: 5, fill: '#141210', stroke: '#e23b2a', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Confirm({ title, body, confirmLabel, onConfirm, onClose, closeLabel, danger = false }) {
  return (
    <Modal title={title} onClose={onClose} closeLabel={closeLabel}>
      <p className="confirm-text">{body}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>{closeLabel}</button>
        <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-gold'}`} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
