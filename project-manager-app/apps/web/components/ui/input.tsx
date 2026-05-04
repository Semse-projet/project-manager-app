import { cn } from "../../lib/cn";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-lg border border-white/[0.08] bg-[#131328] px-3 py-2 text-sm text-ink",
          "placeholder:text-faint",
          "transition-colors duration-120",
          "focus:border-brand focus:outline-none",
          error && "border-red-500/40 focus:border-red-500",
          className
        )}
        {...props}
      />
      {hint && !error ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted"
        >
          {label}
        </label>
      ) : null}
      <textarea
        id={inputId}
        className={cn(
          "w-full rounded-lg border border-white/[0.08] bg-[#131328] px-3 py-2 text-sm text-ink",
          "placeholder:text-faint resize-y",
          "transition-colors duration-120",
          "focus:border-brand focus:outline-none",
          error && "border-red-500/40",
          className
        )}
        {...props}
      />
      {hint && !error ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select({ label, className, id, children, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-[0.68rem] font-semibold tracking-widest uppercase text-muted"
        >
          {label}
        </label>
      ) : null}
      <select
        id={inputId}
        className={cn(
          "w-full rounded-lg border border-white/[0.08] bg-[#131328] px-3 py-2 text-sm text-ink",
          "transition-colors duration-120",
          "focus:border-brand focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
