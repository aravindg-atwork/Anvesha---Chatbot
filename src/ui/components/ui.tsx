import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Loader2, X, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';

export function Button({
  variant = 'secondary',
  size,
  loading,
  icon,
  iconEnd,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'lg'; loading?: boolean; icon?: ReactNode; iconEnd?: ReactNode }) {
  const v = variant === 'secondary' ? '' : `btn-${variant}`;
  return (
    <button
      type="button"
      className={`btn ${v} ${size ? `btn-${size}` : ''} ${className}`}
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <Loader2 size={18} className="spin" aria-hidden /> : icon}
      {children}
      {iconEnd}
    </button>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32">
        <path d="M7 25 16 6l9 19M10.4 18.5h11.2" fill="none" stroke="#f8f4ec" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label} {optional && <span className="faint" style={{ fontWeight: 400 }}>(optional)</span>}
      </label>
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {children(id, [hintId, errId].filter(Boolean).join(' ') || undefined)}
      {error && (
        <span className="field-error" id={errId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  description,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  description?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    (first ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && ref.current) {
        const els = Array.from(ref.current.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(
          (el) => !el.hasAttribute('disabled'),
        );
        if (!els.length) return;
        const [f, l] = [els[0], els[els.length - 1]];
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="modal-head">
          <div className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <h2 id={titleId} style={{ fontSize: '1.6rem' }}>
              {title}
            </h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" data-close>
            <X size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onClose,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={danger ? 'danger-solid' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="muted">{body}</div>
    </Modal>
  );
}

export function Notice({ tone = 'info', children, icon }: { tone?: 'info' | 'warn' | 'danger' | 'ok' | 'plain'; children: ReactNode; icon?: ReactNode }) {
  const Icon = tone === 'warn' || tone === 'danger' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={`notice ${tone !== 'plain' ? `notice-${tone}` : ''}`} role={tone === 'danger' ? 'alert' : undefined}>
      {icon ?? <Icon size={18} aria-hidden />}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-wrap">
      <pre className="code" aria-label={label}>
        {code}
      </pre>
      <Button
        size="sm"
        className="code-copy"
        icon={copied ? <Check size={16} /> : <Copy size={16} />}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
          } catch {
            const ta = document.createElement('textarea');
            ta.value = code;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

// ── Toasts ──────────────────────────────────────────────
type ToastItem = { id: number; text: string; action?: { label: string; run: () => void } };
let toastListeners: ((t: ToastItem[]) => void)[] = [];
let toasts: ToastItem[] = [];
let tid = 0;
export function toast(text: string, action?: ToastItem['action']) {
  const t = { id: ++tid, text, action };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, 4500);
}
export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    toastListeners.push(setItems);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== setItems);
    };
  }, []);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.action && (
            <button className="link-btn" onClick={t.action.run} style={{ color: '#f8f4ec' }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function formatDate(iso: string | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-GB', opts);
}
export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
