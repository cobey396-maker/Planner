import { expect, test, type Page } from "@playwright/test";

/**
 * The app depends on the current time ("what's happening now?"), which makes
 * tests flaky if they run at 11 PM. Playwright's clock lets us set the time:
 * every test runs on Wednesday Oct 14 2026 at 10:40 AM, during Calculus.
 */
test.use({ timezoneId: "America/Chicago", locale: "en-US" });

async function openAt(page: Page, path: string) {
  await page.clock.install({ time: new Date("2026-10-14T10:40:00-05:00") });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(path);
  return errors;
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

test("Today shows what's happening now and what's next", async ({ page }) => {
  await openAt(page, "/today");
  await expect(page.getByText("Happening now")).toBeVisible();
  await expect(page.getByText("Calculus").first()).toBeVisible();
  await expect(page.getByText(/Next: History essay · draft at 2:00 PM/)).toBeVisible();
});

test("adding a task places it in the first free gap and completing it earns points", async ({ page }) => {
  await openAt(page, "/today");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByPlaceholder("Study for chem test").fill("Study for chem test");
  await page.getByRole("button", { name: "30m", exact: true }).click();
  await page.getByRole("button", { name: "Plan it" }).click();

  // Calculus ends 11:45, so the first 30-minute gap after 10:40 is 11:45.
  await expect(page.getByRole("status")).toHaveText(/Planned for today at 11:45 AM/);
  const block = page.getByRole("button", { name: /Study for chem test/ });
  await expect(block).toBeVisible();

  await block.click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("1 of 6 done")).toBeVisible();
  // Confetti canvas appears over the app and never blocks taps.
  await expect(page.locator("#confetti-canvas")).toHaveCSS("pointer-events", "none");

  // State is shared across tabs: the completion shows up on Streaks.
  await page.getByRole("link", { name: "Streaks" }).click();
  await expect(page.getByText("1,350")).toBeVisible();
  await expect(page.getByText("13", { exact: true })).toBeVisible(); // streak +1 today
});

test("Friends shows shared free time without event details and sends an invite", async ({ page }) => {
  await openAt(page, "/friends");
  // Privacy: none of Maya's (or my) event titles appear on this screen.
  await expect(page.getByText("AP Chem")).toHaveCount(0);

  await page.getByRole("button", { name: /Both free/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("Hang out with Maya");
  await page.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByRole("status")).toHaveText(/Invite sent to Maya/);

  await page.getByRole("button", { name: "Accept Alex Kim" }).click();
  await expect(page.getByRole("button", { name: "Alex", exact: true })).toBeVisible();
});

test("no confetti for people who turn on Reduce Motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openAt(page, "/today");
  await page.getByRole("button", { name: /AP Chem/ }).click();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("1 of 5 done")).toBeVisible();
  await expect(page.locator("#confetti-canvas")).toHaveCount(0);
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
