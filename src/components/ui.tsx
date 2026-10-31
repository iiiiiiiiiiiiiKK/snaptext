import {
  forwardRef,
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { IconClose, IconLoader } from './icons';
import { cx } from '../lib/classNames';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <IconLoader size={14} /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('icon-btn', className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3" htmlFor={id}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800 dark:text-ink-100">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-500 dark:text-ink-400">{description}</span>
        ) : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition',
          checked
            ? 'border-accent-600 bg-accent-600 dark:border-accent-500 dark:bg-accent-500'
            : 'border-ink-300 bg-ink-200 dark:border-ink-700 dark:bg-ink-800',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow transition-all',
            checked ? 'left-[1.4rem]' : 'left-0.5',
          )}
          style={{ height: '1.125rem', width: '1.125rem' }}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  onReset,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
  onReset?: () => void;
  testId?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink-600 dark:text-ink-300">{label}</span>
        <span className="flex items-center gap-1">
          <span className="text-[11px] tabular-nums text-ink-500 dark:text-ink-400">{value}</span>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] text-ink-400 underline-offset-2 hover:text-accent-600 hover:underline dark:hover:text-accent-300"
            >
              reset
            </button>
          ) : null}
        </span>
      </div>
      <input
        type="range"
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-accent-600 dark:bg-ink-700"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  return (
    <div
      className={cx('h-1 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        className="h-full rounded-full bg-accent-600 transition-[width] duration-200 dark:bg-accent-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  testId,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  testId?: string;
  width?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-testid={testId}
        className={cx(
          'panel relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-b-none rounded-t-2xl p-5 sm:rounded-xl',
          width,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-900 dark:text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{description}</p>
            ) : null}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <IconClose />
          </IconButton>
        </div>
        <div className="space-y-4">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function TextField({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('field', className)} {...rest} />;
}

export type ToastTone = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:left-auto sm:right-4 sm:items-end"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx(
            'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg animate-fade-in',
            toast.tone === 'error' &&
              'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/80 dark:text-red-200',
            toast.tone === 'success' &&
              'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/80 dark:text-emerald-200',
            toast.tone === 'warning' &&
              'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/80 dark:text-amber-200',
            toast.tone === 'info' &&
              'border-ink-200 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100',
          )}
        >
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded p-0.5 text-current/70 hover:bg-black/5"
            aria-label="Dismiss"
          >
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
