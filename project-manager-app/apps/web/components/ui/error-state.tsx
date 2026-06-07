type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-5 py-4"
    >
      <p className="text-sm font-semibold text-red-400">Error</p>
      <p className="mt-0.5 text-xs text-red-400/80">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-3 text-xs font-semibold text-red-400 underline-offset-2 hover:underline"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

type FeedbackBannerProps = {
  type: "info" | "success" | "error" | "warn";
  message: string;
};

const typeClasses = {
  info:    "border-blue-500/20 bg-blue-500/[0.07] text-blue-300",
  success: "border-green-500/20 bg-green-500/[0.07] text-green-400",
  error:   "border-red-500/20 bg-red-500/[0.07] text-red-400",
  warn:    "border-amber-500/20 bg-amber-500/[0.07] text-amber-300",
};

export function FeedbackBanner({ type, message }: FeedbackBannerProps) {
  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${typeClasses[type]}`}
    >
      {message}
    </div>
  );
}
