/**
 * The "liquid" layer behind every screen: three huge, blurred color orbs that
 * drift slowly on long CSS loops (keyframes drift-a/b/c in globals.css).
 * Glass cards and the tab bar blur whatever is behind them, so as the orbs
 * move, the whole UI gently shifts color, like light through water.
 *
 * Pure CSS (no JavaScript, no re-renders) and transform-only, so it costs
 * almost nothing. Reduce Motion freezes it via the global media query.
 */
export function LiquidBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-[20vmax] -top-[18vmax] size-[60vmax] rounded-full blur-[80px]"
        style={{
          background: "radial-gradient(circle, var(--task-blue), transparent 65%)",
          opacity: "var(--orb-opacity)",
          animation: "drift-a 28s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-[22vmax] top-[25vh] size-[55vmax] rounded-full blur-[80px]"
        style={{
          background: "radial-gradient(circle, var(--task-pink), transparent 65%)",
          opacity: "var(--orb-opacity)",
          animation: "drift-b 34s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-[25vmax] left-[5vw] size-[58vmax] rounded-full blur-[90px]"
        style={{
          background: "radial-gradient(circle, var(--task-purple), transparent 65%)",
          opacity: "var(--orb-opacity)",
          animation: "drift-c 40s ease-in-out infinite",
        }}
      />
    </div>
  );
}
