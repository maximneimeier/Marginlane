import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Field({
  label,
  children,
  hint,
  required,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className ? `block ${className}` : "block"}>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-muted">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </span>
        {children}
      </label>
      {hint ? (
        <div className="mt-1.5 text-[12px] leading-snug text-muted-soft">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-[8px] border border-line bg-white px-3 py-[7px] text-[13px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-soft hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_rgba(38,109,240,0.12)]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ""}`} />
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`${inputClass} min-h-20 ${props.className ?? ""}`}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "secondary";
}) {
  const styles = {
    primary:
      "bg-foreground text-white hover:bg-ink-soft shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
    secondary:
      "border border-line bg-white text-foreground hover:border-line-strong hover:bg-surface-faint",
    ghost:
      "border border-transparent bg-transparent text-muted hover:bg-surface-soft hover:text-foreground",
    danger:
      "border border-red-300 bg-red-50 text-danger hover:border-red-400 hover:bg-red-100",
  };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[13px] font-medium transition-colors disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[12px] border border-line bg-white p-5 shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-xl text-[13px] text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "success";
}) {
  const tones = {
    neutral: "bg-surface-soft text-muted",
    accent: "bg-accent-soft text-accent",
    success: "bg-emerald-50 text-success",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Schließen"
        className="fixed inset-0 bg-foreground/20 backdrop-blur-[6px] transition-opacity"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 my-auto w-full animate-[fadeUp_0.2s_ease-out] rounded-[14px] border border-line bg-white shadow-[0_24px_80px_rgba(28,29,31,0.18)] ${
          wide ? "max-w-[720px]" : "max-w-[520px]"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2
              id="modal-title"
              className="text-[16px] font-semibold tracking-[-0.015em] text-foreground"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-[13px] text-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-muted hover:bg-surface-soft hover:text-foreground"
            aria-label="Schließen"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Löschen",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="flex justify-end gap-2 pb-1">
        <Button variant="secondary" onClick={onClose}>
          Abbrechen
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/** Mülleimer-Icon für Tabellen-Aktionen */
export function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M2.5 3.5h9M5.5 3.5V2.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M6 6v4M8 6v4M3.5 3.5l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Einheitliche Bearbeiten-/Löschen-Aktionen in Listen-Tabellen */
export function TableRowActions({
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => void;
  editLabel: string;
  deleteLabel: string;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="secondary"
        className="h-7 min-w-7 px-2"
        onClick={onEdit}
        aria-label={editLabel}
        title={editLabel}
      >
        ✎
      </Button>
      <Button
        variant="danger"
        className="h-7 min-w-7 px-2"
        onClick={onDelete}
        aria-label={deleteLabel}
        title={deleteLabel}
      >
        <TrashIcon />
      </Button>
    </div>
  );
}
