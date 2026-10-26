# LEARNING.md

A running notebook of everything this project teaches. Each phase adds a
section: what we built, why, the key concepts, and interview questions you
should be able to answer out loud.

---

## Phase 1: Project setup and design system

### What we built, in plain English

Before building any screens, we decided what the app *looks and moves like*
and wrote it down in code once. That "single source of truth" is the design
system. Every later screen is assembled from it, so the app looks
consistent and changes (a new tint color, a rounder corner) happen in one
place.

Concretely:

| Piece | File | What it does |
| --- | --- | --- |
| Project | `package.json` | A standalone Next.js app with lint, typecheck, test and build scripts. |
| Color + type tokens | `app/globals.css` | CSS variables for light and dark mode, exposed to Tailwind as classes like `bg-surface`, `text-headline`, `rounded-card`. |
| JS tokens | `lib/design/tokens.ts` | The task colors and sizes that JavaScript needs (color picker, contrast tests, later the widget). |
| Motion presets | `lib/design/motion.ts` | Five named springs (`snappy`, `smooth`, `bouncy`, `sheet`, `reflow`) and reusable variants. |
| Theme | `lib/theme.ts`, `components/providers.tsx` | System/light/dark preference without a white flash on load. |
| Components | `components/ui/*` | Button, Card, ListGroup, SegmentedControl, Sheet, TabBar, LargeTitlePage, TaskBlock, Skeleton, Empty/Error states. |
| Style guide | `app/design/` | A page at `/design` that shows all of the above. |
| Tests | `tests/unit/*` | 51 Vitest tests that enforce design rules. |

### Key concepts

**1. Design tokens and semantic naming.**
A token is a named design decision: `--tint: #007aff`. We name tokens by
*role* (`surface`, `label`, `secondary-label`), not by *appearance*
(`white`, `gray-500`). Dark mode then becomes "give the same names different
values" instead of "find every white thing and add a dark variant".

**2. Tailwind v4 `@theme`.**
Tailwind v4 is configured in CSS, not a JS config file. Inside `@theme`,
`--color-surface: var(--surface)` generates `bg-surface`, `text-surface`,
`border-surface` and so on. `--text-headline` plus `--text-headline--font-weight`
makes `text-headline` set size, line height and weight together.

**3. Dark mode without a flash (FOUC).**
The server doesn't know your theme (it lives in `localStorage` and your OS).
If React applied it after hydrating, dark-mode users would see a white frame
first. So `layout.tsx` inlines a tiny script in `<head>` that runs *before the
first paint* and sets `<html data-theme="dark">`. `suppressHydrationWarning`
tells React that this attribute differing from the server HTML is expected.
A unit test runs that script string against a fake browser to prove it
agrees with the TypeScript `resolveTheme()` function.

**4. `useSyncExternalStore`.**
React's official hook for reading state that lives outside React
(`localStorage` here). You give it `subscribe`, `getSnapshot`, and a server
snapshot. It avoids the common bug of reading `localStorage` in `useState`'s
initializer, which crashes on the server or causes hydration mismatches.

**5. Springs instead of durations.**
A duration-based animation ("300ms, ease-out") restarts from zero velocity
when interrupted, which looks robotic. A spring simulates physics: it has
position *and velocity*, so an interrupted animation keeps its momentum.
That's the core of the iOS feel. Motion describes springs with
`visualDuration` (how long until it looks settled) and `bounce`.
For plain CSS transitions we approximate a spring with the `linear()` easing
function (a list of points that overshoots 1 and settles back).

**6. Reduced motion is an accessibility requirement.**
Some people get motion sickness from animation. Two layers handle it:
`<MotionConfig reducedMotion="user">` makes every Motion animation drop
movement (keeping fades), and a `@media (prefers-reduced-motion: reduce)` CSS
rule makes CSS transitions instant. One gotcha: Motion only disables
*transform* animations. Animating `left` would still move, which is why the
spring demo uses `layout` (a transform under the hood) instead.

**7. Layout animations and `layoutId`.**
`<motion.div layout>` measures where an element was and where it is after a
re-render, then animates between them with a transform (the FLIP technique:
First, Last, Invert, Play). `layoutId` does the same across *different*
elements with the same id: the segmented control's sliding thumb. This is
what will make the schedule reflow smoothly in Phase 6.

**8. Server Components vs Client Components.**
In the App Router everything is a Server Component unless the file starts
with `"use client"`. Server Components ship no JS to the browser. We only mark
things as client when they need state, effects or browser APIs (animations,
the theme, the sheet). `app/design/page.tsx` stays a server component and
imports the client `DesignShowcase`.

**9. Tests that enforce design rules.**
Rules from the brief became tests so they can't silently regress:
- every motion preset is a spring (no linear easing),
- the CSS and TypeScript task colors match,
- text on every tinted task block passes WCAG AA contrast (4.5:1) in both
  themes. The test implements the WCAG luminance formula and `color-mix`.

**10. A real bug we hit: `tailwind-merge` and custom tokens.**
`cn()` uses `tailwind-merge` to let later classes override earlier ones. It
didn't know `text-headline` is a font *size*, assumed it was a text *color*,
and deleted `text-on-tint`, so the primary button had black text. We caught it
by screenshotting the page, fixed it with `extendTailwindMerge`, and added a
regression test. Lesson: tooling that "understands" your classes needs to be
told about your custom ones.

### Interview questions

**Q1. How does your app support dark mode, and how do you avoid the white
flash on load?**
Colors are CSS variables named by role (`--surface`, `--label`). Light values
live on `:root`, dark values on `[data-theme="dark"]`, and Tailwind classes
reference the variables, so no component knows which theme is active. The
preference (system/light/dark) is stored in `localStorage`. Because the server
can't read it, a small inline script in `<head>` resolves the theme and sets
`data-theme` before the first paint. React reads the same preference through
`useSyncExternalStore` and listens for OS theme changes when set to "system".

**Q2. Why use spring animations instead of CSS easing curves?**
Springs are physically based: they carry velocity. If a user interrupts an
animation (flicks a sheet, taps twice), a spring continues smoothly from its
current speed, while a duration-based animation restarts from rest and looks
mechanical. Springs also don't need a fixed duration, so the same preset feels
right for short and long distances. We centralize five presets so the whole
app feels consistent, honor Reduce Motion globally with `MotionConfig`, and a
unit test enforces that every preset is a spring.

**Q3. How do you make sure your color palette is accessible?**
Each task block's background is the task color mixed 16% into the surface
color. A unit test reproduces that `color-mix`, computes WCAG relative
luminance, and asserts the contrast ratio between the label color and every
block background is at least 4.5:1 (WCAG AA) in light and dark mode. Another
test parses `globals.css` to make sure the CSS and TypeScript copies of the
palette never drift apart. Secondary text uses translucent label colors so it
adapts to any background.

### Glossary

- **Token**: a named design value (color, size, radius, spring).
- **Semantic color**: a token named by purpose (`danger`) rather than hue (`red`).
- **FOUC**: flash of unstyled (or wrongly themed) content.
- **Hydration**: React attaching interactivity to server-rendered HTML.
- **FLIP**: First, Last, Invert, Play; the trick behind layout animations.
- **WCAG AA**: accessibility standard; 4.5:1 contrast for body text.
- **Safe area**: the parts of an iPhone screen not covered by the notch or
  home indicator (`env(safe-area-inset-*)`).

---

## Interlude: every screen, and a "liquid" redesign

### What we built, in plain English

Before wiring up a database, we designed every tab with realistic sample
data: Today, Week, Streaks, Friends and Settings. We split the long design
system page into four focused screens. And we made the whole app feel more
like one fluid material: frosted-glass cards, a floating glass tab bar with a
sliding "lens", slowly drifting color blobs behind everything, and **one**
animation spring used everywhere instead of five presets.

Designing with fake data first is a real industry practice. It lets you find
UX problems (and the shape of the data you need) before you commit to a
database schema in Phase 2.

### Key concepts

**1. Route groups, layouts and templates (Next.js App Router).**
`app/(tabs)/` is a *route group*: the parentheses organize files without
adding `/tabs` to the URL. Its `layout.tsx` is **not** re-mounted when you
switch tabs, so it's where shared state (`PlannerProvider`) and the tab bar
live. Its `template.tsx` **is** re-mounted on every navigation, so it's where
the page transition goes.

**2. Shared layout animations (`layoutId`).**
The tab bar's lens, the Week day picker and every chip row use one
`motion.span` with a `layoutId`. When selection changes, React renders it
somewhere else and Motion animates it from the old spot to the new one.
Because the tab bar lives in the persistent layout, the lens even glides
between *pages*.

**3. One motion token.**
`lib/design/motion.ts` now exports a single spring, `fluid`. Fewer knobs means
a more consistent feel, and it's easier to explain: "every animation in the
app is the same physical material."

**4. Glassmorphism done carefully.**
`glass-card` is a translucent background, `backdrop-filter: blur()`, a
1px border, and an inset top highlight (light catching the rim). The blobs
behind are pure CSS keyframes that only animate `transform`, which the GPU
handles cheaply, and they freeze under Reduce Motion.

**5. Time and hydration.**
The server renders HTML before it knows the user's clock or time zone. If it
printed "9:41 AM" and the browser then printed "3:12 PM", React would throw a
hydration error. `useNow()` uses `useSyncExternalStore` with a `null` server
snapshot, so time-dependent UI renders a skeleton on the server and fills in
on the client.

**6. Interval math: the heart of free time.**
`lib/planner/free-time.ts` has three small algorithms:
- `mergeIntervals`: sort by start, then sweep once, extending the last merged
  span whenever the next one overlaps. O(n log n).
- `freeWindows`: walk the merged busy list with a cursor and record the gaps.
- `sharedFreeWindows`: free time for two people is just the free windows of
  *both* busy lists combined. It needs only busy spans, never event titles,
  which is exactly the privacy rule for Friends.

**7. End-to-end tests with a controlled clock.**
`tests/e2e/app.spec.ts` drives a real browser through the app. Playwright's
`page.clock.install({ time })` starts every test at Wednesday 10:40 AM, so
"Happening now: Calculus" is deterministic no matter when the tests run.

### Bugs we hit (great interview stories)

- **Invalid HTML caused a hydration error.** The loading skeleton (a `<div>`)
  was rendered inside the subtitle's `<p>`. Browsers "fix" that by moving the
  div out, so the DOM no longer matched React's output (React error #418).
  Fix: the subtitle wrapper is now a `<div>`.
- **Entrance animations hid server-rendered content.** `initial={{ opacity: 0 }}`
  means the server sends HTML with opacity 0, so the page is blank until
  JavaScript loads. `useEntrance()` skips entrance animations on the very
  first load; later navigations still animate.
- **An "it doesn't work" that was correct.** Adding a task failed at 11:14 PM
  because the planner only schedules until 11 PM. The fix was UX, not logic:
  the sheet now starts at "Tomorrow" late at night.

### Interview questions

**Q1. How do you show two friends' shared free time without leaking their
schedules?**
Each person's calendar is reduced to busy intervals (start/end only), and
event titles never leave their account. To find time together I combine both
busy lists, merge overlapping intervals (sort plus one linear sweep), and
take the gaps inside the visible day that are at least 45 minutes long. The UI
only ever draws busy/free spans. In Phase 9 that reduction happens on the
server with row-level security, so the client never even receives titles.

**Q2. What's the difference between a layout and a template in Next.js, and
why did you use both?**
A layout persists across navigations between its child routes; a template is
re-created on each navigation. I put the planner state and the tab bar in the
layout so state survives tab switches and the tab bar's sliding indicator can
animate between pages. I put the page transition in the template because it
needs to run every time the page changes.

**Q3. How do you avoid hydration errors with time-based UI?**
The server can't know the user's local time, so any rendering based on "now"
would differ between server and client. My `useNow` hook uses
`useSyncExternalStore` with a server snapshot of `null`, so the server and the
first client render both show a skeleton, then the client fills in real
times. I also learned that invalid HTML nesting (a div inside a p) causes
hydration errors too, because the browser rewrites the DOM before React
hydrates it.

---

## Add-on: confetti when a task is completed

`lib/confetti.ts` draws celebration confetti on one shared full-screen
`<canvas>` with zero dependencies. There are three shapes: curly
**streamers** (a sine wave whose phase shifts every frame, so the string
wiggles), paper **strips** that fake a 3D tumble by squashing their height
with `cos(flip)`, and small **dots**. Streamers are "lighter": less gravity
and more drag, so they float down slower, like real ribbon. Each piece has a
velocity; every
animation frame adds gravity (`vy += 0.35`), applies air drag (`vx *= 0.98`),
spins and fades it, and the `requestAnimationFrame` loop stops itself once all
particles are invisible. The canvas is sized by `devicePixelRatio` so it stays
crisp on retina screens, and has `pointer-events: none` so it never blocks taps.

It's called from **one place**: `toggleComplete` in `lib/planner/store.tsx`,
the single path every completion goes through. Two details worth explaining
in an interview:

- **Only on the transition to done.** We check `!completed.has(id)` first, so
  un-checking a task never celebrates.
- **Side effects stay out of state updaters.** The confetti call sits outside
  the `setCompleted(prev => ...)` updater, because React may run updaters twice
  in development (Strict Mode) and the confetti would fire twice.
- **Reduce Motion is respected.** If the OS setting is on, no confetti (the
  "+10 points" toast still confirms the action). A unit test and an e2e test
  cover both cases.

---

## Add-on: the sign-up screen

The root page (`/`) is now the front door: **Create your account**, with a
**Sign in** mode, Apple/Google buttons, and "Explore with sample data". Real
accounts arrive with Supabase Auth in Phase 3; the screen is built so only the
`submit` function changes then.

Key concepts:

- **One schema, two places.** `lib/auth/schema.ts` defines the rules with zod.
  The browser uses it for instant feedback; in Phase 3 the server runs the
  same schema, because client-side checks can always be bypassed.
- **Normalize, then validate.** The email is trimmed and lowercased *before*
  the format check (`z.string().trim().toLowerCase().pipe(z.email())`), so a
  trailing space from autofill doesn't fail. A unit test caught this.
- **Friendly validation timing.** No red while you type your first attempt; a
  field is checked when you leave it; after the first submit, errors update
  live and vanish the moment they're fixed.
- **Accessible forms.** Real `<label>`s, `aria-invalid`, errors linked with
  `aria-describedby` and announced with `role="alert"`, and the right
  `autocomplete` values (`new-password` vs `current-password`) so password
  managers offer to generate or fill passwords.
- **Never store passwords client-side.** Until Phase 3 only the name and email
  are remembered locally so Settings can greet you; sign out clears them.

---

## Phase 2: Database schema, Prisma, and row-level security

### What we built, in plain English

The app needs somewhere to keep your tasks, schedule, points and friends that
survives a refresh, and it must be impossible for one person to see
another's data. We designed the tables in `prisma/schema.prisma`, generated
the SQL with Prisma, and hand-wrote the security layer: Postgres row-level
security (RLS) policies, constraints, triggers and a few database functions.
Everything is tested against real Postgres running inside the test process
(PGlite), so `npm test` proves the security rules on any laptop.

Full details and setup steps: [DATABASE.md](DATABASE.md).

### Key concepts

**1. Row-level security (RLS).** With Supabase, the browser talks to the
database through Supabase's API, carrying the user's login token. RLS is a
Postgres feature that filters every query by a policy like
`user_id = auth.uid()`. It's "deny by default": a table with RLS on and no
policy returns nothing. The security lives in the database, so a bug in our
API code (or someone calling the API directly) can't bypass it.

**2. Defense in depth with Prisma.** Prisma connects as the table OWNER, and
owners skip RLS. So `prismaForUser()` wraps each query in a transaction that
sets the user's JWT claims and does `SET LOCAL ROLE authenticated`. A test
proves a `findMany()` with no `where` still only returns your rows.

**3. Privileges vs policies.** GRANTs decide *which operations and columns*
a role may touch at all; policies decide *which rows*. We use both:
`points_ledger` is GRANT SELECT only (nobody can insert fake points), and
`hangout_invites` grants UPDATE only on `status` and `responded_at`, so the
recipient can answer an invite but not rewrite it.

**4. SECURITY DEFINER functions, carefully.** Some actions need more power
than the user has (looking up a profile by invite code, awarding points).
Those run as the function's owner, so each one checks `auth.uid()` itself,
sets `search_path = ''` (so nobody can hijack it with look-alike tables), and
EXECUTE is revoked from `public` and `anon`.

**5. Constraints the database enforces.** The planner must never double-book
you: an *exclusion constraint* with a GiST index rejects any two blocks of the
same user whose time ranges overlap (`[)` ranges, so 9–10 and 10–11 may
touch). Every rule the database enforces is a bug the app can't introduce.

**6. Time zones and daylight saving.** Exact moments (blocks, due dates) are
`timestamptz`. Recurring events are stored as local wall-clock minutes plus
the user's IANA zone, and expanded per day with `AT TIME ZONE`, so "gym at
6 PM" is still 6 PM after the clocks change. A test checks the Nov 1 2026
switch: 23:00Z before, 00:00Z after.

**7. Privacy by construction.** Friends never get read access to events or
tasks. `friend_busy_intervals()` returns only `(starts_at, ends_at)`, and only
for accepted friends. Helper functions also refuse to answer "are X and Y
friends?" unless you are X or Y.

**8. Testing security by trying to break it.** The tests act as attackers:
read someone else's tasks, attach a block to their task, insert 1000 points,
answer an invite you sent. I also deliberately weakened two policies and
confirmed the tests failed. A test suite that can't fail proves nothing.

### Interview questions

**Q1. How do you make sure users can only access their own data?**
Postgres row-level security on every table, with policies comparing
`user_id` to `auth.uid()`, the user id from their verified login token. RLS
is deny-by-default, and it's enforced by the database, so it holds even if
the API code has a bug or someone calls Supabase directly. Because Prisma
connects as the table owner, which bypasses RLS, I wrap user queries so they
run as the `authenticated` role with the user's claims. Tests sign in as
different users and confirm cross-user reads return nothing and cross-user
writes are rejected.

**Q2. How do you prevent double-booking at the database level?**
An exclusion constraint: `EXCLUDE USING gist (user_id WITH =,
tstzrange(starts_at, ends_at, '[)') WITH &&)`. It needs the btree_gist
extension so one index can combine equality on the user with overlap on the
time range. Postgres checks it atomically on every insert and update, so even
two concurrent requests can't both succeed, which an app-level "check then
insert" could not guarantee.

**Q3. How do you handle recurring events across daylight saving time?**
I store recurring events as local wall-clock times (minutes since midnight)
plus the owner's IANA time zone, not as UTC instants. To find occurrences, I
generate each local date in the range and convert `date + time` with `AT TIME
ZONE 'America/Chicago'`, which applies the right UTC offset for that specific
date. So a 6 PM class is 23:00 UTC in October and 00:00 UTC the next day in
November, and a unit test checks exactly that.

---

## Phase 3: Auth and onboarding

### What we built, in plain English

Real accounts. Supabase Auth stores passwords securely (hashed with bcrypt),
sends confirmation and password-reset emails, and gives each signed-in
person a short-lived **access token** (a signed JWT) plus a **refresh token**,
both kept in cookies. Every page, server action and database query can then
tell who you are. New accounts go through a three-step onboarding (name,
time zone, planning hours) that fills in the settings the auto-planner needs.
Without Supabase configured, the app runs in **demo mode** with sample data.

### Key concepts

**1. Server actions.** `"use server"` functions (in `app/actions/`) run only
on the server, but the browser calls them like ordinary async functions.
Passwords go from our server straight to Supabase, and validation runs
again on the server, because anything in the browser can be bypassed.

**2. Cookies, not localStorage.** `@supabase/ssr` keeps the session in
cookies so the server can read it for server-rendered pages and the
middleware. *Correction:* I first wrote that these cookies are httpOnly.
They are not, by default: the browser-side Supabase client needs to read
them. So the real defense against stolen sessions is not having cross-site
scripting bugs at all (React escapes text by default; we never use
`dangerouslySetInnerHTML` with user data) plus short-lived access tokens.
Our own invite cookie (`pending-invite`) *is* httpOnly because only the
server reads it.

**3. Verify, don't trust.** On the server we use `getClaims()`, which checks
the token's cryptographic signature. `getSession()` would just read the
cookie, and cookies can be edited. I tested this: a hand-forged session
cookie claiming to be an onboarded user was redirected to the sign-up page.

**4. Middleware as the gatekeeper.** `middleware.ts` runs before every page.
It refreshes expiring tokens and asks `routeFor()` where the request
belongs. Keeping the rules in a pure function means 20 fast unit tests cover
every combination (signed out, demo, new account, member).

**5. The stale token trap.** "Onboarded" lives in the user's metadata, which
is copied into the access token. After saving onboarding the OLD token
still says `onboarded: false`, so the middleware would bounce you straight
back to onboarding forever. The fix: `refreshSession()` right after
`updateUser()` to mint a token with the new value.

**6. Not leaking who has an account.** Sign-in says "email or password is
incorrect" (never which one), password reset always says "if that email has
an account…", and Supabase's sign-up answers the same way for existing
emails. Otherwise attackers could use our forms to test which emails are
registered ("user enumeration").

**7. Open redirects.** Links like `/auth/callback?next=…` could be abused to
bounce people to a phishing site right after a real login.
`safeNext()` only allows paths on our own site; tests include
`https://evil.example`, `//evil.example` and `/\evil.example`.

**8. Testing code that talks to a service.** The server actions are tested
with a fake Supabase client (`vi.mock`) that records calls and returns
whatever each test needs: success, "check your email", rate limits. That
tests OUR logic quickly and deterministically, without a network.

### Interview questions

**Q1. How does authentication work in your app, end to end?**
The sign-up form calls a Next.js server action, which re-validates the input
with zod and calls Supabase Auth. Supabase hashes the password, sends a
confirmation email, and on confirmation the link hits my `/auth/callback`
route, which exchanges a one-time code for a session stored in cookies
(readable by the Supabase browser client, so not httpOnly). On every request, middleware refreshes the token if needed, verifies
it with `getClaims()`, and redirects based on a pure `routeFor()` function.
Database queries carry the same token, so Postgres row-level security
enforces the same identity.

**Q2. Why verify the JWT on the server instead of reading the session cookie?**
A cookie is just data the browser sends; anyone can edit it. The JWT inside
is signed by Supabase, so verifying the signature (`getClaims()`) proves it
wasn't forged or modified. I tested it by forging a session cookie that
claimed to be an onboarded user: the middleware treated it as signed out.

**Q3. What security mistakes did you design against in the auth flow?**
User enumeration (generic messages for sign-in and password reset), open
redirects (`safeNext()` only allows same-site paths), trusting client-side
validation (every action re-validates with the same zod schema), leaking
secrets (only the public publishable key is in the browser; the database
password is server-only), and stale state (refreshing the token after
changing metadata). Each one has a unit test.

## Update: real data everywhere (fresh accounts, 24/7 planning, emails)

**In plain English:** the screens stopped using sample data. A new account
now starts truly empty (no tasks, 0 streak, 0 points, no friends, every
badge locked) and everything you see is computed from what you actually do.

What changed and why:

- **24/7 planning.** No more "planning hours". Auto placement uses the first
  open quarter hour from *now* (for today) or from 8 AM (other days), and you
  can also pick an exact time. Onboarding still asks your **time zone**,
  plus an optional **city and state** and **profile photo** (skip it and you
  get your initials).
- **Time zones done properly** (`lib/tz.ts`). A "day" is midnight to midnight
  *in your zone*, which is 23 or 25 hours on daylight-saving days. Blocks are
  stored as UTC instants; we convert only for display. Week hours come from
  one function (`hoursByDay`) used by both the chart and the grid, so they
  can't disagree.
- **Stats from data** (`lib/planner/stats.ts`): streak = consecutive days
  with at least one finished block (yesterday still counts until midnight),
  10 points per finished block, purple flame at 10+ days, and each badge has
  a precise rule. All pure functions, unit-tested.
- **Friends without filler.** "People you may know" comes from a Postgres
  function, `suggest_friends()`: friends of friends first (ranked by mutual
  count), then people in the same city and state. Only people who left
  "Suggest me to others" on are shown. Invite links (`/add/<code>`) work even
  before the friend has an account: the code waits in a cookie until they
  finish onboarding.
- **First-run tour** of Today, Week, Streaks and Friends, saved on the
  account so it shows once.
- **Email notifications** until there's an installed app: a cron endpoint
  (`/api/cron/notifications`) asks Postgres to *claim* due reminders
  (`claim_notifications()` marks them sent in the same statement, so two
  overlapping cron runs can't email twice), then sends them with Resend.
- **Profile photos** are cropped and shrunk to 256px in the browser before
  upload (fast, and it strips GPS data hidden in phone photos). Storage
  policies only let you write inside your own folder.

**Key concepts:** UTC storage vs. local display, DST-safe day ranges,
derived state (compute stats instead of storing them), claim-then-send for
exactly-once jobs, SECURITY DEFINER functions as a narrow, audited door
through row-level security.

**Interview questions**

**Q1. How do you store times for users in different time zones?**
As UTC instants (`timestamptz`), plus each user's IANA zone name. All
"which day is this?" logic converts to the user's zone at the edges. Never
store "local time without a zone", and never assume a day is 24 hours: on
DST days it's 23 or 25, so I compute a day's range as midnight-to-next-
midnight in that zone.

**Q2. How do you stop a scheduled job from sending the same email twice?**
Make "pick the work" and "mark it taken" one atomic step. My
`claim_notifications()` runs an `UPDATE ... SET reminder_sent_at = now()
WHERE reminder_sent_at IS NULL ... RETURNING ...`, so a second run (or an
overlapping one) finds nothing left to claim. The trade-off is at-most-once:
if sending fails after claiming, that email is lost, which is acceptable for
reminders.

**Q3. How do friend suggestions work without leaking private data?**
A SECURITY DEFINER function runs with elevated rights but only returns a
fixed, minimal set of columns (name, handle, photo, city, mutual count) for
people who opted in, excluding you and anyone you're already connected to.
Clients can't query other users' profiles directly; RLS blocks that. The
function is the only, narrow door.

## Update: Schedule Helper (AI), repeating tasks, 31 badges, and a saving bug

**In plain English:** you can now talk to the planner ("gym at 5 every
Monday, Thursday and Friday") and it does it; tasks can repeat or go on many
days at once, up to a year ahead; there are 25 new badges; and we fixed a
bug where some accounts couldn't save tasks at all.

### The bug: "I press Plan it and nothing shows up"
Tasks belong to a profile (a foreign key). An account created *before* the
sign-up trigger existed never got its profile row, so every task insert was
rejected by the database, and the only sign was a small red message at the
bottom of a long sheet. How we found it: a local copy of the real stack
(Postgres + PostgREST + a fake auth server) reproduced it exactly. The fix
has three layers: migration 3 repairs existing accounts; the app calls
`ensure_my_account()` if it ever finds the rows missing; and errors now also
show as a toast. Lesson: never let a write fail quietly, and test against
the real stack, not just mocks.

### Repeating tasks
A repeating task is ONE task with one block per occurrence. Each occurrence
can be finished, moved or deleted on its own ("This one" / "All 6"), and
streaks and badges need no special cases. `expandRepeat()` turns a rule into
dates; `placeMany()` places the task on each date and *skips* days that are
full instead of failing the whole request.

### The Schedule Helper (tool use)
Claude can't touch the database directly. We give it six **tools**
(`get_schedule`, `find_free_time`, `add_task`, `move_block`, `set_done`,
`delete`), each a zod schema plus a function. The SDK's **tool runner** loops:
Claude asks for a tool → we validate the input and run it with the user's own
token (so row-level security still applies) → we send back the result →
Claude continues, until it answers. The reply **streams** to the browser as
newline-delimited JSON, and when anything changed we send the fresh schedule
so every tab updates. The API key stays on the server.

**Key concepts:** foreign keys and silent failures, reproducing bugs on the
real stack, modeling recurrence as data, LLM tool use (function calling),
streaming responses, keeping secrets server-side, feature flags for a future
paywall.

**Interview questions**

**Q1. How do you let an LLM change user data safely?**
Expose a small set of narrow tools instead of raw database access, validate
every tool input with a schema, run tools with the end user's own
permissions (here, Postgres row-level security), reuse the same business
logic as the UI, cap iterations and request rates, and keep the API key on
the server. The model proposes; your code decides.

**Q2. How would you store recurring events?**
Two options: store the rule (like an iCal RRULE) and expand it when reading,
or expand it into rows when creating. I expanded into rows (one block per
occurrence, capped at 120, up to a year ahead) because each occurrence needs
its own state (done, moved, deleted) and stats become simple queries. The
trade-off: "edit all future occurrences" means updating many rows.

**Q3. A user says "the button does nothing." How do you debug it?**
Reproduce it in an environment as close to theirs as possible, watch the
network/server logs for the failing request, and read the actual error (here
a foreign-key violation). Then fix the root cause, repair existing bad data,
add a self-healing path, make the error visible, and add a test that fails
without the fix.

## Update: usernames, log in, and keeping the schedule in sync

**Usernames.** Picked at sign-up, checked as you type. The check is
*debounced* (we wait 400 ms after the last keystroke before asking the
server) and ignores stale answers, so a slow reply for "cob" can't overwrite
the answer for "cobey". The database is the real referee: a unique index
means two people can never end up with the same name, even if they press
"Create account" at the same instant.

**Logging in with a username without leaking emails.** The browser never
learns anyone's email: the server, using the secret key, swaps the username
for an email and signs in. "No such user" and "wrong password" get the same
message, so nobody can test which usernames exist by logging in.

**Keeping every tab in sync.** After saving, the app now re-loads your
schedule from the database (and again when you come back to the app), so
the screen always matches what's actually saved. The server prints the real
error in the terminal if a save fails.

**Interview question: how do you build a "username available?" check?**
Validate the format locally first, debounce the server call, ignore
out-of-order responses, and still enforce uniqueness in the database
(unique index) because the check can be stale by the time you submit.

## Update: XP, levels, rewards and a friends leaderboard

**In plain English:** finishing blocks earns XP (more if early or on a
streak), missing them costs a little, XP fills levels, levels unlock flame
colors and titles, and friends race on a weekly leaderboard. Hitting a new
level gets a big Fortnite-style celebration.

**Design choices worth knowing:**
- **The server is the referee.** XP is only written by database functions
  (the browser can read its ledger but never write it), the daily cap stops
  farming, and equipping is checked by a trigger. The app also computes the
  same numbers locally for an instant update, then swaps in the server's
  exact total: *optimistic UI with server reconciliation*.
- **A ledger, not a counter.** Every XP change is a row with a reason
  (complete, early, streak, missed). Totals are sums, undo deletes rows, and
  the history explains every number.
- **One rule set, two languages.** The level formula lives in SQL and in
  TypeScript; a test compares them for every level so they can't drift.
- **Loss aversion, gently.** Missing costs XP but can never drop your level,
  like Fortnite: motivating without being punishing.

**Interview questions**

**Q1. How do you stop users from cheating a points system?**
Never trust the client: compute rewards on the server from facts it
controls (the block, its time, the user's history), store them in an
append-only ledger users can't write to, make awards idempotent (one row per
block and reason), and add caps for farming.

**Q2. Why a ledger instead of a `points` column?**
A column loses history and races under concurrent updates. A ledger is
auditable, easy to undo (delete the rows for that block), supports reasons
and time windows (weekly leaderboards are a `where created_at >= …`), and the
total is just a sum.

**Q3. How do you keep the same logic in the database and the app consistent?**
Put the source of truth in one place (the database), mirror only what the UI
needs, and write a test that runs both implementations over many inputs and
compares the results.

---

## Update: an installable app (PWA)

### What we built, in plain English

The site can now be installed like a real app. On Android (and desktop
Chrome) an **Install app** button appears; on iPhone we show the two taps
Safari needs (Share, then Add to Home Screen). Once installed it opens
full-screen from its own icon, starts on Today, and shows a friendly
"You're offline" screen instead of the browser's dinosaur when there's no
signal.

| Piece | File | What it does |
| --- | --- | --- |
| Manifest | `app/manifest.ts` | Name, icons, colors, `display: standalone`, start on `/today`. Served at `/manifest.webmanifest`. |
| Icons | `scripts/make-icons.mjs` → `public/icons/*`, `app/apple-icon.png` | PNGs generated from `app/icon.svg`, including a "maskable" one with a safe zone. |
| Service worker | `public/sw.js` | Network-first pages with an offline fallback; cache-first build files; never caches API calls or private data. |
| Offline page | `app/offline/page.tsx` | Static, precached at install. |
| Install prompt | `components/planner/install-prompt.tsx`, `lib/pwa.ts` | Captures `beforeinstallprompt`, iOS instructions, hides when installed. On Today (dismissible) and Settings. |

### Key concepts

**1. What makes a site installable.** A manifest with a name, a start URL,
`display: standalone` and 192 and 512 px icons, served over HTTPS (localhost
counts), plus a service worker. iOS reads `apple-touch-icon` and the
`apple-mobile-web-app-*` tags instead of most of the manifest.

**2. Service worker caching strategies.** *Network-first* (pages: fresh when
online, fallback offline), *cache-first* (files whose names contain a content
hash, so a cached copy can never be stale), and *don't touch* (anything
personal or dynamic). Picking per request type is the whole design.

**3. Updating a service worker safely.** The browser re-checks `sw.js` on
each visit, so it must never be HTTP-cached (`next.config.ts` sends
`no-cache`). Bumping `VERSION` makes the new worker delete old caches in
`activate`. In development we unregister workers so they can't serve stale
dev files.

**4. Platform detection without lying to yourself.** iPadOS reports a Mac
user agent; touch points give it away. Logic like this lives in a pure
function (`installPlatform`) so it's unit-tested instead of guessed.

**Interview questions**

**Q1. What's the difference between a PWA and a native app?**
A PWA is a website with a manifest and a service worker: one codebase, no
app store review or 15-30% fee, instant updates. Native apps get deeper OS
access (widgets, background tasks, some notifications on older iOS) and
store discovery.

**Q2. Why not cache everything for offline use?**
Stale or private data is worse than no data: a cached schedule could show
deleted tasks, and a shared device could leak someone's account. Cache only
what's safe and correct to serve old.

**Q3. How would you ship a fix if a bad service worker went out?**
Deploy a new `sw.js` (it's fetched uncached, so browsers see it on the next
visit), call `skipWaiting()`/`clients.claim()` so it takes over at once, and
delete old caches on activate. Worst case, a worker that unregisters itself.
