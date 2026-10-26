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

/** Open the sheet, name the task, run `choose` to pick when, then plan it. */
async function addTaskWith(page: Page, title: string, choose: () => Promise<void>) {
  await page.getByRole("button", { name: "Add task" }).first().click();
  await page.getByPlaceholder("Study for chem test").fill(title);
  await choose();
  await page.getByRole("button", { name: /Plan it/ }).click();
}

test("every tab loads without errors and the tab bar navigates", async ({ page }) => {
  const errors = await openAt(page, "/today");
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  for (const [tab, heading] of [
    ["Week", "Week"],
    ["Streaks", "Streaks"],
    ["Friends", "Friends"],
    ["Helper", "Schedule Helper"],
    ["Settings", "Settings"],
    ["Today", "Today"],
  ]) {
    await page.getByRole("link", { name: tab }).click();
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
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
    ["Schedule Helper", "/helper"],
  ]) {
    await expect(tour.getByRole("heading", { name: tab })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await tour.getByRole("button", { name: tab === "Schedule Helper" ? "Let's go" : "Next" }).click();
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
  await expect(page.getByTestId("level")).toHaveText("1");
  await expect(page.getByTestId("xp")).toHaveText("0 XP · 500 to go");
  await expect(page.getByTestId("flame")).toHaveAttribute("data-color", "grey");
  await expect(page.getByTestId("reward-classic")).toHaveAttribute("data-unlocked", "true");
  await expect(page.getByTestId("reward-blue")).toHaveAttribute("data-unlocked", "false");
  await expect(page.getByText("Nothing due yet this week")).toBeVisible();
  await expect(page.getByTestId("badge-count")).toHaveText("0 of 31");
  for (const badge of await page.locator("[data-testid^=badge-][data-earned]").all()) {
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
  // +100 XP (10:45 AM: no early bonus; day 1 of a streak: no streak bonus yet).
  await expect(page.getByTestId("xp")).toHaveText("100 XP · 400 to go");
  await expect(page.getByTestId("flame")).toHaveAttribute("data-color", "classic");
  await expect(page.getByText("You hit 100% of your plan")).toBeVisible();
  // Exactly one badge unlocks: "First step". Everything else stays locked.
  await expect(page.getByTestId("badge-first_step")).toHaveAttribute("data-earned", "true");
  await expect(page.locator("[data-testid^=badge-][data-earned=true]")).toHaveCount(1);
  await expect(page.getByTestId("badge-count")).toHaveText("1 of 31");
});

test("a repeating task: gym at 5 PM every Mon, Thu and Fri for 2 weeks", async ({ page }) => {
  await openAt(page, "/week");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByPlaceholder("Study for chem test").fill("Gym");
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await page.getByRole("radio", { name: "Repeat" }).click();
  await page.getByRole("button", { name: "Choose days" }).click();
  // Today (Wednesday) starts selected; switch to Mon, Thu, Fri.
  await page.getByRole("button", { name: "Wed", exact: true }).click();
  for (const d of ["Mon", "Thu", "Fri"]) await page.getByRole("button", { name: d, exact: true }).click();
  await page.getByLabel("Repeat for").selectOption("14");
  await page.getByLabel("Start time").selectOption(String(17 * 60));
  // Wed Oct 14 → Tue Oct 27: Thu 15, Fri 16, Mon 19, Thu 22, Fri 23, Mon 26.
  await expect(page.getByTestId("repeat-summary")).toHaveText("6 times, every Mon, Thu & Fri at 5:00 PM, until Oct 26");
  await page.getByRole("button", { name: "Plan it (6×)" }).click();
  await expect(page.getByRole("status")).toHaveText("Planned 6 times");

  // This week: Thursday and Friday have 1h each; next week has three.
  await expect(page.getByRole("button", { name: "Thursday, Oct 15: 1h planned" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Friday, Oct 16: 1h planned" })).toBeVisible();
  await expect(page.getByText("2h this week")).toBeVisible();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByText("3h this week")).toBeVisible();
  await expect(page.getByRole("button", { name: "Monday, Oct 19: 1h planned" })).toBeVisible();

  // Deleting just one occurrence keeps the rest.
  await page.getByLabel("Monday, October 19", { exact: true }).click();
  await page.getByTestId("day-grid").getByRole("button", { name: /Gym/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Repeats: 6 times");
  await page.getByRole("button", { name: "This one" }).click();
  await expect(page.getByText("2h this week")).toBeVisible();
});

test("plan a month ahead with the calendar, or pick several days at once", async ({ page }) => {
  await openAt(page, "/today");
  await addTaskWith(page, "Dentist", async () => {
    await page.getByRole("button", { name: "Pick a later date" }).click();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("button", { name: "Friday, November 20", exact: true }).click();
  });
  await expect(page.getByRole("status")).toHaveText("Planned for Fri, Nov 20 at 8:00 AM");

  await addTaskWith(page, "Essay drafts", async () => {
    await page.getByRole("radio", { name: "Pick days" }).click();
    await page.getByRole("button", { name: "Wednesday, October 14", exact: true }).click(); // un-pick today
    await page.getByRole("button", { name: "Monday, October 19", exact: true }).click();
    await page.getByRole("button", { name: "Wednesday, October 21", exact: true }).click();
    await page.getByRole("button", { name: "Next month" }).click();
    await page.getByRole("button", { name: "Monday, November 2", exact: true }).click();
  });
  await expect(page.getByRole("status")).toHaveText("Planned 3 times");
});

test("Schedule Helper needs an account (no AI calls in demo mode)", async ({ page }) => {
  await openAt(page, "/helper");
  await expect(page.getByRole("heading", { name: "Schedule Helper", level: 1 })).toBeVisible();
  await expect(page.getByText("Schedule Helper needs an account")).toBeVisible();
});

test("five finished blocks: level up to 2, celebrated Fortnite-style", async ({ page }) => {
  await openAt(page, "/today");
  for (const name of ["One", "Two", "Three", "Four", "Five"]) await addTask(page, name, "15m");
  for (const name of ["One", "Two", "Three", "Four"]) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await page.getByRole("button", { name: "Mark complete" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: /^Five/ }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  const levelUp = page.getByRole("dialog", { name: "2" });
  await expect(levelUp).toContainText("Level up!");
  await expect(levelUp).toContainText("You reached level 2");
  await levelUp.getByRole("button", { name: "Let's go!" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The leaderboard on Friends shows you with your XP this week.
  await page.getByRole("link", { name: "Friends" }).click();
  await expect(page.getByTestId("leaderboard")).toContainText("You");
  await expect(page.getByTestId("leaderboard")).toContainText("Level 2");
  await expect(page.getByTestId("leaderboard")).toContainText("500");
});

test("demo mode: tasks stay saved after a refresh, and Settings says where", async ({ page }) => {
  await openAt(page, "/today");
  await expect(page.getByTestId("demo-notice")).toContainText("saved on this device only");
  await addTask(page, "Keep me", "30m");
  await expect(page.getByRole("button", { name: /Keep me/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Keep me/ })).toBeVisible();
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByTestId("saved-to")).toHaveText("This device only");
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
  await page.getByLabel("Name", { exact: true }).fill("Cobey");
  await expect(page.getByText("What should we call you?")).toHaveCount(0);

  // Usernames are checked as you type.
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("ab");
  await expect(page.getByText("At least 3 characters")).toBeVisible();
  await page.getByRole("textbox", { name: "Username", exact: true }).fill("Cobey_D");
  await expect(page.getByTestId("username-status")).toHaveText("@cobey_d is available");
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

test("Log in: one tap away, and it takes an email or a username", async ({ page }) => {
  await openAt(page, "/");
  await page.getByRole("radio", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Username", exact: true })).toHaveCount(0);
  const who = page.getByLabel("Email or username");
  await who.fill("a b");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Enter a valid email or username")).toBeVisible();
  await who.fill("@cobey_d");
  await expect(page.getByText("Enter a valid email or username")).toHaveCount(0);
  // And back to sign-up.
  await page.getByRole("radio", { name: "Sign up" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("onboarding asks name, photo (skippable), place and home screen, with no planning hours", async ({ page }) => {
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

  // Then: add the app to your home screen (skippable). Desktop Chrome in the
  // test gets the general directions, and Back is gone (answers are saved).
  await expect(page.getByRole("heading", { name: "Put it on your home screen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeHidden();
  await page.getByRole("button", { name: "Maybe later" }).click();

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
