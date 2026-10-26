/**
 * The "liquid" layer behind every screen: three huge, soft color glows.
 * Glass cards and the tab bar blur whatever is behind them, so the UI picks
 * up a gentle tint, like light through water.
 *
 * The glows are deliberately STILL. They used to drift on endless CSS loops,
 * but a moving background means the browser must redraw the whole screen
 * every frame, forever, and re-blur every glass surface on top of it. On
 * phones that kept the GPU and main thread busy even when nothing else was
 * happening, and taps took up to ~2 s to register. Static, the page costs
 * nothing at rest. (See LEARNING.md, "Fix: taps took seconds on phones".)
 *
 * No CSS `filter: blur()` either: the radial gradients already fade to
 * transparent, and blurring a layer bigger than the screen is expensive to
 * paint for almost no visible difference.
 */
export function LiquidBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-[20vmax] -top-[18vmax] size-[60vmax] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--task-blue), transparent 70%)",
          opacity: "var(--orb-opacity)",
        }}
      />
      <div
        className="absolute -right-[22vmax] top-[25vh] size-[55vmax] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--task-pink), transparent 70%)",
          opacity: "var(--orb-opacity)",
        }}
      />
      <div
        className="absolute -bottom-[25vmax] left-[5vw] size-[58vmax] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--task-purple), transparent 70%)",
          opacity: "var(--orb-opacity)",
        }}
      />
    </div>
  );
}
