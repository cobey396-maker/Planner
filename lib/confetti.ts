/**
 * Celebration confetti, drawn on one shared full-screen <canvas>.
 * Zero dependencies: plain Canvas 2D + requestAnimationFrame.
 *
 * Three shapes, like a real party popper:
 *   - streamer: a curly ribbon of string. Drawn as a sine wave whose phase
 *     shifts every frame, so it wiggles as it flies.
 *   - strip:    a paper rectangle that tumbles. Real paper flips over in the
 *     air; we fake that 3D flip by squashing its height with cos(flip), so
 *     it shrinks to a sliver and grows back as it "turns".
 *   - dot:      a small round sequin.
 *
 * The canvas is fixed over the whole app with pointer-events: none, so it
 * never blocks a tap. Gravity (vy += …) and air drag (v *= …) make pieces
 * arc and fall; the loop stops itself once every piece has faded out.
 *
 * devicePixelRatio: on a 3x iPhone screen we size the canvas 3x larger in
 * real pixels and scale the drawing back down, so everything stays crisp.
 */

type Shape = "streamer" | "strip" | "dot";

type Particle = {
  shape: Shape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  rotation: number; // degrees
  rotSpeed: number;
  opacity: number;
  /** streamer: length; strip: width; dot: radius */
  size: number;
  /** strip: tumble angle; streamer: wave phase */
  flip: number;
  flipSpeed: number;
  /** streamer: how far the curl swings sideways */
  amplitude: number;
};

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

/** Mostly streamers (the "string" look), plenty of strips, a few dots. */
function pickShape(): Shape {
  const r = Math.random();
  if (r < 0.5) return "streamer";
  if (r < 0.88) return "strip";
  return "dot";
}

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

  const particles: Particle[] = Array.from({ length: count }, () => {
    const shape = pickShape();
    // Launch upward in a 90° fan (45°–135°), randomly to the left or right.
    const angle = Math.PI / 4 + Math.random() * (Math.PI / 2);
    const speed = Math.random() * 12 + 8;
    return {
      shape,
      x: w / 2,
      y: h / 2,
      vx: Math.cos(angle) * (Math.random() > 0.5 ? speed : -speed),
      vy: -Math.sin(angle) * speed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * (shape === "streamer" ? 6 : 12),
      opacity: 1,
      size:
        shape === "streamer"
          ? Math.random() * 18 + 22 // 22–40px long
          : shape === "strip"
            ? Math.random() * 4 + 6 // 6–10px wide
            : Math.random() * 2 + 2.5, // 2.5–4.5px radius
      flip: Math.random() * Math.PI * 2,
      flipSpeed: shape === "streamer" ? Math.random() * 0.25 + 0.15 : Math.random() * 0.2 + 0.08,
      amplitude: Math.random() * 3 + 3,
    };
  });

  /** A curly ribbon: a sine wave along the x axis, centered on the origin. */
  function drawStreamer(p: Particle) {
    const half = p.size / 2;
    const waves = 1.6; // how many curls along its length
    ctx.beginPath();
    for (let x = -half; x <= half; x += 2) {
      const y = Math.sin((x / p.size) * waves * Math.PI * 2 + p.flip) * p.amplitude;
      if (x === -half) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  /** A paper strip tumbling in 3D: its height follows cos(flip). */
  function drawStrip(p: Particle) {
    const width = p.size;
    const height = p.size * 1.8 * Math.cos(p.flip);
    ctx.fillStyle = p.color;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    // The "back" of the paper is a touch darker, which sells the flip.
    if (height < 0) {
      ctx.fillStyle = "rgb(0 0 0 / 0.18)";
      ctx.fillRect(-width / 2, -height / 2, width, height);
    }
  }

  function drawDot(p: Particle) {
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }

  function render() {
    ctx.clearRect(0, 0, w, h);
    let active = 0;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      // Light ribbons catch more air: they fall slower and drift more.
      const light = p.shape === "streamer";
      p.vy += light ? 0.28 : 0.35; // gravity
      p.vx *= light ? 0.97 : 0.98; // air drag
      if (light) p.vy *= 0.99;
      p.rotation += p.rotSpeed;
      p.flip += p.flipSpeed;
      p.opacity -= 0.008;

      if (p.opacity > 0) {
        active++;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        if (p.shape === "streamer") drawStreamer(p);
        else if (p.shape === "strip") drawStrip(p);
        else drawDot(p);
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
