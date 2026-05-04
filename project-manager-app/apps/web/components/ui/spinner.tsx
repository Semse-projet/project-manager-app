import { cn } from "../../lib/cn";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-2",
};

export function Spinner({ size = "md", className }: SpinnerProps) {
  return (
    <span
      aria-label="Cargando"
      role="status"
      className={cn(
        "inline-block animate-spin rounded-full border-brand border-t-transparent",
        sizeClasses[size],
        className
      )}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-40 items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
