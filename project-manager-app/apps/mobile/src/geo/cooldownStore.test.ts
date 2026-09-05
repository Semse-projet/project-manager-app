import { isCoolingDown, markCooldown } from "./cooldownStore";

describe("cooldownStore", () => {
  it("is not cooling down for a site that was never marked", async () => {
    expect(await isCoolingDown("job:never-marked")).toBe(false);
  });

  it("is cooling down immediately after being marked", async () => {
    await markCooldown("job:abc");
    expect(await isCoolingDown("job:abc")).toBe(true);
  });

  it("tracks cooldowns per site independently", async () => {
    await markCooldown("job:one");
    expect(await isCoolingDown("job:one")).toBe(true);
    expect(await isCoolingDown("free:two")).toBe(false);
  });

  it("expires the cooldown after the window passes", async () => {
    const realNow = Date.now;
    let now = 1_000_000;
    Date.now = () => now;
    try {
      await markCooldown("job:expiring");
      expect(await isCoolingDown("job:expiring")).toBe(true);

      now += 21 * 60 * 1000; // > 20 min cooldown window
      expect(await isCoolingDown("job:expiring")).toBe(false);
    } finally {
      Date.now = realNow;
    }
  });
});
