// Jev Decision Layer — per-feature circuit breaker (handoff §34).
// After `threshold` consecutive provider failures (unavailable / timeout /
// provider_error) calls to Jev stop for `cooldownMs`; decisions fall back to
// the deterministic path with reason "circuit_open". After the cooldown one
// trial call is let through (half-open): success closes the breaker, failure
// re-opens it. In-memory per API instance — a restart resets it, which is
// safe because the failure mode is "fall back", never "call more".
export class DecisionCircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly options: () => { threshold: number; cooldownMs: number },
    private readonly now: () => number = Date.now,
  ) {}

  /** True when a call may go to the provider right now. */
  allow(): boolean {
    if (this.openedAt === null) return true;
    if (this.now() - this.openedAt >= this.options().cooldownMs) return true; // half-open trial
    return false;
  }

  get state(): "closed" | "open" | "half_open" {
    if (this.openedAt === null) return "closed";
    return this.now() - this.openedAt >= this.options().cooldownMs ? "half_open" : "open";
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.openedAt !== null || this.failures >= this.options().threshold) {
      this.openedAt = this.now();
    }
  }
}
