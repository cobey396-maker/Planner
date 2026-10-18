import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end tests in demo mode (no account, nothing on the server), which
 * starts exactly like a brand-new account: no tasks, no points, no friends.
 *
 * The app depends on the current time, which makes tests flaky if they run
 * at 11 PM. Playwright's clock pins it: every test starts on Wednesday
 * Oct 14 2026 at 10:40 AM in Chicago. Auto placement starts on the next
 * quarter hour, so the first new task lands at 10:45.
 */
test.use({ timezoneId: "America/Chicago", locale: "en-US" });

async function openAt(page: Page, path: string, { tour = false } = {}) {
  await page.clock.install({ time: new Date("2026-10-14T10:40:00-05:00") });
  // Most tests skip the first-run tour; the tour has its own test.
  if (!tour) await page.addInitScript(() => localStorage.setItem("tour-done", "1"));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  return errors;
}

async function addTask(page: Page, title: string, duration: string) {
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByPlaceholder("Study for chem test").fill(title);
  await page.getByRole("button", { name: duration, exact: true }).click();
  await page.getByRole("button", { name: "Plan it" }).click();
}

test("every tab loads without errors and the tab bar navigates", async ({ page }) => {
  const errors = await openAt(page, "/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  for (const tab of ["Week", "Streaks", "Friends", "Settings", "Today"]) {
    await page.getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { name: tab, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: tab })).toHaveAttribute("aria-current", "page");
  }
  expect(errors).toEqual([]);
});

test("a new account gets a one-time tour of every tab except Settings", async ({ page }) => {
  const errors = await openAt(page, "/today", { tour: true });
  const tour = page.getByRole("dialog");
  for (const [tab, path] of [
    ["Today", "/today"],
    ["Week", "/week"],
    ["Streaks", "/streaks"],
    ["Friends", "/friends"],
  ]) {
    await expect(tour.getByRole("heading", { name: tab })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await tour.getByRole("button", { name: tab === "Friends" ? "Let's go" : "Next" }).click();
  }
  await expect(tour).toHaveCount(0);
  await expect(page).toHaveURL(/\/today$/);

  // It never shows again.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Today starts empty with a smiley, no filler tasks", async ({ page }) => {
  await openAt(page, "/today");
  await expect(page.getByRole("heading", { name: "No tasks for today" })).toBeVisible();
  await expect(page.getByText("😊")).toBeVisible();
});

test("the Week tab's + adds a task and the hours chart matches the schedule", async ({ page }) => {
  await openAt(page, "/week");
  await expect(page.getByText("0h this week")).toBeVisible();
  await expect(page.getByText("Nothing planned this day.")).toBeVisible();

  await addTask(page, "Study for chem test", "1h 30m");
  // Auto placement: the first open quarter hour from now.
  await expect(page.getByRole("status")).toHaveText(/Planned for today at 10:45 AM/);

  const grid = page.getByTestId("day-grid");
  await expect(grid.getByRole("button", { name: /Study for chem test/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wednesday, Oct 14: 1h 30m planned" })).toBeVisible();
  await expect(page.getByText("1h 30m this week")).toBeVisible();

  // A second task goes right after the first, on the same day.
  await addTask(page, "Gym", "1h");
  await expect(page.getByRole("status")).toHaveText(/Planned for today at 12:15 PM/);
  await expect(page.getByRole("button", { name: "Wednesday, Oct 14: 2h 30m planned" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thursday, Oct 15: 0h planned" })).toBeVisible();
});

test("streaks start at 0, badges start locked, and finishing a block counts", async ({ page }) => {
  await openAt(page, "/streaks");
  await expect(page.getByTestId("streak")).toHaveText("0");
  await expect(page.getByTestId("points")).toHaveText("0");
  await expect(page.getByTestId("flame")).toHaveAttribute("data-color", "grey");
  await expect(page.getByText("Nothing due yet this week")).toBeVisible();
  for (const badge of await page.locator("[data-testid^=badge-]").all()) {
    await expect(badge).toHaveAttribute("data-earned", "false");
  }

  await page.getByRole("link", { name: "Today" }).click();
  await addTask(page, "Read chapter 4", "30m");
  await page.getByRole("button", { name: /Read chapter 4/ }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("Everything done. Legend.")).toBeVisible();
  // Confetti appears over the app and never blocks taps.
  await expect(page.locator("#confetti-canvas")).toHaveCSS("pointer-events", "none");

  await page.getByRole("link", { name: "Streaks" }).click();
  await expect(page.getByTestId("streak")).toHaveText("1");
  await expect(page.getByTestId("points")).toHaveText("10");
  await expect(page.getByTestId("flame")).toHaveAttribute("data-color", "orange");
  await expect(page.getByText("You hit 100% of your plan")).toBeVisible();
  // One 30-minute block at 10:45 AM doesn't unlock anything yet.
  await expect(page.locator("[data-testid^=badge-][data-earned=true]")).toHaveCount(0);
});

test("Friends starts empty: no made-up people", async ({ page }) => {
  await openAt(page, "/friends");
  await expect(page.getByRole("heading", { name: "No friends yet" })).toBeVisible();
  await expect(page.getByText(/to see people you may know/)).toBeVisible();
  await page.getByRole("button", { name: "Invite a friend" }).first().click();
  await expect(page.getByRole("dialog")).toContainText("You need an account to get your own invite link.");
});

test("Settings has email notifications info and no planning hours", async ({ page }) => {
  await openAt(page, "/settings");
  await expect(page.getByText("Email notifications")).toBeVisible();
  await expect(page.getByText("Planning hours")).toHaveCount(0);
  await expect(page.getByText("America/Chicago")).toBeVisible();
});

test("no confetti for people who turn on Reduce Motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAt(page, "/today");
  await addTask(page, "Essay", "1h");
  await page.getByRole("button", { name: /Essay/ }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("Everything done. Legend.")).toBeVisible();
  await expect(page.locator("#confetti-canvas")).toHaveCount(0);
});

test("sign-up validates the form, then welcomes you into the app", async ({ page }) => {
  const errors = await openAt(page, "/");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

  // Submitting empty shows a friendly error on every field.
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("What should we call you?")).toBeVisible();
  await expect(page.getByText("Enter a valid email, like you@example.com")).toBeVisible();

  // Errors clear as soon as each field is fixed.
  await page.getByLabel("Name").fill("Cobey");
  await expect(page.getByText("What should we call you?")).toHaveCount(0);
  await page.getByLabel("Email").fill("Cobey@Example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await expect(page.getByText("Use at least 8 characters")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill("Planner12345!");
  await expect(page.getByText("Strong")).toBeVisible();

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole("status")).toHaveText(/Welcome, Cobey!/);

  // Settings greets you by name; signing out returns to the front door.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("cobey@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("switching to sign in hides the name field", async ({ page }) => {
  await openAt(page, "/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("onboarding asks name, photo (skippable) and place, with no planning hours", async ({ page }) => {
  const errors = await openAt(page, "/onboarding");
  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeDisabled(); // can't skip the name
  await page.getByLabel("Your name").fill("Cobey Lapp");
  await next.click();

  // No photo: the picker shows your initials, and you can skip.
  await expect(page.getByRole("heading", { name: "Add a profile photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add profile photo" })).toContainText("CL");
  await page.getByRole("button", { name: "Skip for now" }).click();

  await expect(page.getByRole("heading", { name: "Where are you?" })).toBeVisible();
  // The browser's zone (set by the test) is detected and pre-selected.
  await expect(page.getByLabel("Time zone")).toHaveValue("America/Chicago");
  await page.getByPlaceholder("City").fill("Austin");
  await page.getByLabel("State").selectOption("Texas");

  // Back keeps your answers.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await expect(page.getByPlaceholder("City")).toHaveValue("Austin");
  await expect(page.getByText(/When can we plan/)).toHaveCount(0);

  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByRole("heading", { name: "You're all set, Cobey!" })).toBeVisible();
  await expect(page.locator("#confetti-canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Let's go" }).click();
  await expect(page).toHaveURL(/\/today$/);
  expect(errors).toEqual([]);
});

test("the theme switch in Settings flips the whole app", async ({ page }) => {
  await openAt(page, "/settings");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("the design system is split into separate screens", async ({ page }) => {
  await openAt(page, "/settings");
  await page.getByRole("link", { name: /Design system/ }).click();
  for (const name of ["Colors & glass", "Typography", "Components", "States & feedback"]) {
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Design" }).click();
  }
});
