# Auto-Planner

Tell it what you need to do, and it plans your week. A mobile-first schedule
app for teens and young adults, with a native iOS "liquid glass" feel.

> Status: **Phase 1 complete, plus every screen designed with sample data.**
> The database, accounts and the real scheduling algorithm come next.
> What each phase taught is in [LEARNING.md](LEARNING.md).

![All five tabs and the design system in light mode](docs/screenshots/overview-light.png)
![The same screens in dark mode](docs/screenshots/overview-dark.png)

## Screens

| Tab | What it does |
| --- | --- |
| **Today** | Progress ring, "Happening now" card, the day as a timeline with free gaps. **+** opens the Add Task sheet, which drops the task into the first free slot. Tap a block for details (complete / delete). |
| **Week** | Hours planned per day (bar chart), a day picker, and the chosen day as an hour grid. |
| **Streaks** | Streak and points (they update as you complete blocks), weekly recap ("You hit 82% of your plan"), badges. |
| **Friends** | Friend requests, invite link, and **free time together**: only busy/free spans are shown, never event names. Tap a shared slot to send an invite. |
| **Settings** | Theme, notifications, schedule preferences, and a link to the design system. |
| **Design system** (`/design`) | Split into Colors & glass, Typography, Components, and States & feedback. |

Everything runs on sample data in the browser for now (see `lib/planner/mock.ts`).

## Run it

Requires Node.js 22.6 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3002 and tap **Open my week**. On Windows PowerShell, use
`npm.cmd` instead of `npm` if scripts are blocked.

## Checks

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest unit tests (63) |
| `npm run test:e2e` | Playwright end-to-end tests in a real browser, light and dark (12) |
| `npm run check` | Lint, typecheck, unit tests, then a production build |

Before the first `npm run test:e2e` on a new machine, download the test browser
once with `npx playwright install chromium`.

For local environment variables, copy `.env.example` to `.env.local`.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Motion · Vaul ·
zod · Vitest · Playwright. Coming in later phases: Supabase (Postgres, Auth,
Realtime), Prisma, dnd-kit, the Claude API, and Capacitor.

## Layout

```
app/
  (tabs)/            route group: today, week, streaks, friends, settings
    layout.tsx       shared shell: planner state + floating tab bar
    template.tsx     page transition between tabs
  design/            design system hub + 4 sub-screens
  globals.css        design tokens, liquid glass utilities, background orbs
components/
  screens/           one file per tab
  planner/           Add Task and task-detail sheets
  design/            design-system sub-screens
  ui/                reusable components (glass cards, tab bar, chips, …)
lib/
  planner/           types, sample data, client state, free-time math
  design/            tokens, the single `fluid` spring, entrance helper
  time.ts            time formatting and week math
  use-now.ts         the current time, safely (no hydration mismatch)
tests/
  unit/              Vitest
  e2e/               Playwright
```

## Roadmap

1. ✅ Project setup, design system
2. Database schema + Prisma + RLS
3. Auth + onboarding
4. Today and Week views with fixed events (UI ✅, real data next)
5. Tasks + auto-scheduling algorithm + unit tests
6. Drag-to-reschedule + swipe-to-complete
7. Natural-language input with Claude API
8. Streaks + weekly recap (UI ✅)
9. Friends + shared free time + realtime (UI ✅)
10. Notifications, settings, privacy/terms pages (Settings UI ✅)
11. PWA setup, testing, deploy to Vercel
12. Capacitor wrap for iOS/Android + store-launch checklist
