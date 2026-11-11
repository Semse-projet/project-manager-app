/**
 * Track the latest async read of a Time Tracker view.
 *
 * A response can update the UI only when its generation is still current.
 * Invalidate synchronously when changing filters; React effect cleanup may
 * run after an already-settled earlier promise.
 */
export function createTrackerRequestGate() {
  let generation = 0;
  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    invalidate(): void {
      generation += 1;
    },
    isCurrent(requestGeneration: number): boolean {
      return requestGeneration === generation;
    },
  };
}
