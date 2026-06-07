/**
 * (app)/loading.tsx — Skeleton screen while page is loading
 * Shown automatically by Next.js during RSC / page transitions
 */
export default function AppLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "4px 0",
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      {/* Page title skeleton */}
      <div
        style={{
          height: "28px",
          width: "220px",
          borderRadius: "8px",
          background: "var(--overlay, #1a2333)",
        }}
      />

      {/* Stat cards row */}
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            style={{
              flex: "1 1 160px",
              height: "88px",
              borderRadius: "12px",
              background: "var(--overlay, #1a2333)",
            }}
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--border, #1f2d3d)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "48px",
            background: "var(--raised, #111827)",
            borderBottom: "1px solid var(--border, #1f2d3d)",
          }}
        />
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            style={{
              height: "52px",
              background: i % 2 === 0 ? "var(--raised, #111827)" : "var(--surface, #0c1017)",
              borderBottom: "1px solid var(--border, #1f2d3d)",
              padding: "14px 20px",
              display: "flex",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <div style={{ width: "120px", height: "12px", borderRadius: "4px", background: "var(--overlay, #1a2333)" }} />
            <div style={{ width: "80px", height: "12px", borderRadius: "4px", background: "var(--overlay, #1a2333)" }} />
            <div style={{ width: "60px", height: "20px", borderRadius: "20px", background: "var(--overlay, #1a2333)", marginLeft: "auto" }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
