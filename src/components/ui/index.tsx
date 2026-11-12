"use client";
import * as React from "react";
import { cn } from "@/lib/cn";
import { Loader2, X, Inbox } from "lucide-react";

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
};
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...p }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-9 px-4 text-sm",
        variant === "primary" && "bg-accent text-white hover:bg-accent-dark",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-hover",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-ink",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
      {...p}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

const field = "w-full rounded border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 hover:border-muted/40 focus-visible:border-accent disabled:opacity-50";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cn(field, "h-9", className)} {...p} />);
Input.displayName = "Input";
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => <textarea ref={ref} className={cn(field, "py-2 leading-relaxed", className)} {...p} />);
Textarea.displayName = "Textarea";
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...p }, ref) => <select ref={ref} className={cn(field, "h-9", className)} {...p} />);
Select.displayName = "Select";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      {React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-line bg-surface shadow-soft", className)} {...p} />;
}
export function CardHeader({ title, action, desc }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div><h2 className="text-sm font-semibold">{title}</h2>{desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}</div>
      {action}
    </div>
  );
}

const tones = {
  neutral: "bg-hover text-muted", accent: "bg-accent-soft text-accent-dark",
  success: "bg-success-soft text-success", danger: "bg-danger-soft text-danger", warn: "bg-warn-soft text-warn",
};
export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function Tabs({ tabs, value, onChange }: { tabs: string[]; value: string; onChange: (t: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)}
          className={cn("-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
            value === t ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink")}>{t}</button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "accent" }: { value: number; tone?: "accent" | "success" | "danger" }) {
  const c = { accent: "bg-accent", success: "bg-success", danger: "bg-danger" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", c)} style={{ width: `${value}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 rounded", className)} aria-hidden />;
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted/60" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {desc && <p className="max-w-sm text-xs text-muted">{desc}</p>}
      {action}
    </div>
  );
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-hover"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute -top-8 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{text}</span>
    </span>
  );
}

/** Banner that makes mock data unmistakable (plan: never present mock data as production data). */
export function MockBanner() {
  return (
    <div className="mb-6 rounded border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
      <strong>Preview only.</strong> This screen uses mock data. Actions are not connected to a backend yet.
    </div>
  );
}

type Toast = { id: number; msg: string; tone: "success" | "danger" | "neutral" };
const ToastCtx = React.createContext<(msg: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => React.useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const push = React.useCallback((msg: string, tone: Toast["tone"] = "neutral") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, tone }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("rounded border bg-surface px-4 py-2 text-sm shadow-lg",
            t.tone === "success" && "border-success/40", t.tone === "danger" && "border-danger/40", t.tone === "neutral" && "border-line")}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function PageHeader({ title, desc, actions, crumbs }: { title: string; desc?: string; actions?: React.ReactNode; crumbs?: string[] }) {
  return (
    <div className="mb-6">
      {crumbs && <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">{crumbs.join(" / ")}</nav>}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{desc && <p className="mt-1 text-sm text-muted">{desc}</p>}</div>
        {actions}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Delete", loading }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: string; confirmLabel?: string; loading?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`;
