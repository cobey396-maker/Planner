/**
 * Celebration confetti, drawn on one shared full-screen <canvas>.
 * Zero dependencies: plain Canvas 2D + requestAnimationFrame.
 *
 * The canvas is fixed over the whole app with pointer-events: none, so it
 * never blocks a tap. Each particle is a little square with its own velocity,
 * spin and fade; gravity (vy += 0.35) and air drag (vx *= 0.98) make them
 * arc and fall. The loop stops itself once every particle has faded out.
 *
 * devicePixelRatio: on a 3x iPhone screen we size the canvas 3x larger in
 * real pixels and scale the drawing back down, so the squares stay crisp.
 */
export function fireConfetti(count = 100): void {
  // Accessibility: people who turn on Reduce Motion don't get a screen full
  // of flying particles (the app's other feedback, like the toast, still shows).
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  let canvas = document.getElementById("confetti-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText =
      "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;";
    document.body.appendChild(canvas);
  }

  const maybeCtx = canvas.getContext("2d");
  if (!maybeCtx) return; // Canvas unsupported (very old browsers, some test DOMs).
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.resetTransform();
  ctx.scale(dpr, dpr);

  const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];
  const particles = Array.from({ length: count }, () => {
    // Launch upward in a 90° fan (45°–135°), randomly to the left or right.
    const angle = Math.PI / 4 + Math.random() * (Math.PI / 2);
    const speed = Math.random() * 12 + 8;
    return {
      x: w / 2,
      y: h / 2,
      vx: Math.cos(angle) * (Math.random() > 0.5 ? speed : -speed),
      vy: -Math.sin(angle) * speed,
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    };
  });

  function render() {
    ctx.clearRect(0, 0, w, h);
    let active = 0;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.vx *= 0.98; // air drag
      p.rotation += p.rotSpeed;
      p.opacity -= 0.008;

      if (p.opacity > 0) {
        active++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }

    if (active > 0) {
      requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
  }

  render();
}
