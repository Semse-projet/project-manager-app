import { cn } from "../../lib/cn";

type CardProps = {
  className?: string;
  children: React.ReactNode;
  as?: "article" | "section" | "div" | "aside";
};

export function Card({ className, children, as: Tag = "div" }: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-white/[0.08] bg-[#0d0d20] p-5",
        className
      )}
    >
      {children}
    </Tag>
  );
}

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
  className?: string;
};

export function MetricCard({ label, value, sub, accent, className }: MetricCardProps) {
  return (
    <article
      className={cn(
        "rounded-xl border p-4",
        accent
          ? "border-brand/20 bg-brand/[0.06]"
          : "border-white/[0.07] bg-[#131328]",
        className
      )}
    >
      <span className="block text-[0.68rem] font-semibold tracking-widest uppercase text-muted">
        {label}
      </span>
      <strong className="mt-1.5 block text-2xl font-bold tracking-tight text-ink leading-none">
        {value}
      </strong>
      {sub ? <p className="mt-1.5 text-xs text-muted">{sub}</p> : null}
    </article>
  );
}
