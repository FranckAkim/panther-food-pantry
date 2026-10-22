import { test, expect } from "@playwright/test";

// Each test gets a fresh browser context/storage. All changes stay in the demo.
// Freeze the sample calendar, while leaving timers and async loading functional.
test.beforeEach(async ({ page, baseURL }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T17:00:00Z"));
  const external = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL).origin) return route.continue();
    external.push(url.origin);
    return route.abort();
  });
  page.testErrors = errors;
  page.externalRequests = external;
});

test.afterEach(async ({ page }) => {
  expect(page.testErrors, "No uncaught browser errors").toEqual([]);
  expect(page.externalRequests, "Demo must not call external services").toEqual([]);
});

async function signIn(page, role) {
  await page.goto(role === "student" ? "/#/sign-in" : `/#/${role}/sign-in`);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill(role === "student" ? "jordan@pvamu.edu" : `${role}@pvamu.edu`);
  await page.locator('input[name="password"]').fill("Pantry2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: role === "student" ? "Hi, Jordan" : "Dashboard",
      exact: true,
    }),
  ).toBeVisible();
}

async function readRecord(page, key) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
}

test("keyboard sign-in supports skip navigation, dialog dismissal, and form submission", async ({
  page,
}) => {
  await page.goto("/#/sign-in");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  const email = page.getByRole("textbox", { name: "Email", exact: true });
  await email.focus();
  await page.keyboard.type("jordan@pvamu.edu");
  await page.keyboard.press("Tab");
  const help = page.getByRole("button", { name: "Forgot password?" });
  await expect(help).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Password help" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(help).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('input[name="password"]')).toBeFocused();
  await page.keyboard.type("Pantry2026!");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Hi, Jordan", exact: true })).toBeVisible();
});

test.describe("narrow-screen acceptance", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function expectNoPageOverflow(page) {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }

  test("student home, request, and history stay within the viewport", async ({ page }) => {
    await signIn(page, "student");
    await expectNoPageOverflow(page);
    await page.getByRole("link", { name: "Request food", exact: true }).click();
    await expect(page.getByRole("combobox")).toBeVisible();
    await expectNoPageOverflow(page);
    await page.getByRole("link", { name: "History", exact: true }).click();
    await expectNoPageOverflow(page);
  });

  test("staff navigation hides closed links and supports keyboard dismissal", async ({ page }) => {
    await signIn(page, "staff");
    const opener = page.getByRole("button", { name: "Open navigation", exact: true });
    const sidebar = page.locator("#workspace-navigation");
    await expect(sidebar).toBeHidden();
    await opener.focus();
    await page.keyboard.press("Tab");
    expect(await sidebar.evaluate((element) => element.contains(document.activeElement))).toBe(
      false,
    );
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(sidebar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expect(opener).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("link", { name: "Donations", exact: true }).click();
    await expect(sidebar).toBeHidden();
    await expect(page.getByRole("button", { name: "Save donation", exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
  });
});

test("sign-in rejects invalid credentials, persists a session, and protects routes after logout", async ({
  page,
}) => {
  await page.goto("/#/sign-in");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("jordan@pvamu.edu");
  await page.locator('input[name="password"]').fill("Incorrect-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Email or password is incorrect/)).toBeVisible();
  await expect(page).toHaveURL(/#\/sign-in$/);
  await signIn(page, "student");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi, Jordan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Account and sign out" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/#/student/home");
  await expect(page).toHaveURL(/#\/sign-in$/);
  expect(await readRecord(page, "panther-demo-profile")).toBeNull();
});

test("student request persists, reserves a slot, and cancellation releases it", async ({
  page,
}) => {
  await signIn(page, "student");
  await page.getByRole("button", { name: "Request food", exact: true }).click();
  await page.getByRole("combobox").selectOption("black-beans");
  await page.getByRole("button", { name: "Thu, Oct 15", exact: true }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Request submitted");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const request = (await readRecord(page, "panther-staff-requests")).find(
    (request) => request.foodId === "black-beans" && request.studentId === "P00281734",
  );
  expect(request.status).toBe("Waiting");
  const reserved = (await readRecord(page, "panther-pickup-slots-v1")).find(
    (slot) => slot.id === request.slotId,
  );
  expect(reserved.booked).toBe(4);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your request is waiting for approval" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel request", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel request", exact: true }).click();
  await expect(page.getByText("You have no open request.", { exact: true })).toBeVisible();
  const requests = await readRecord(page, "panther-staff-requests");
  expect(requests.find((entry) => entry.id === request.id).status).toBe("Cancelled");
  const released = (await readRecord(page, "panther-pickup-slots-v1")).find(
    (slot) => slot.id === request.slotId,
  );
  expect(released.booked).toBe(reserved.booked - 1);
});

test("walk-in requires ID verification and completed pickup deducts stock once", async ({
  page,
}) => {
  await signIn(page, "staff");
  await page.getByRole("button", { name: "Walk-in", exact: true }).click();
  await page.getByPlaceholder("Enter student ID").fill("P00281734");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Jordan Ellis found.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hand out food", exact: true }).click();
  await expect(
    page.getByText("Check the student’s ID card before continuing.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Hand out food", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hand out food", exact: true })).toBeVisible();
  await page.getByRole("combobox").selectOption("black-beans");
  await page.getByRole("spinbutton").fill("1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Complete pickup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today's pickups", exact: true })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true }).last()).toBeVisible();
  const inventory = await readRecord(page, "panther-inventory-v1");
  const beans = inventory.find((item) => item.id === "black-beans");
  expect(beans.lots.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(47);
  const pickup = (await readRecord(page, "panther-staff-pickups")).find(
    (entry) => entry.id.startsWith("walk-in-") && entry.studentId === "P00281734",
  );
  expect(pickup.status).toBe("Completed");
  // Revisiting a stale distribution screen must not consume the stock again.
  await page.goto("/#/staff/distribution");
  await page.getByRole("combobox").selectOption("black-beans");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Complete pickup", exact: true }).click();
  await expect(
    page.getByText("This pickup has already been completed.", { exact: true }),
  ).toBeVisible();
  expect(await readRecord(page, "panther-inventory-v1")).toEqual(inventory);
});

test("saving a donation adds its lot and preserves the record after reload", async ({ page }) => {
  await signIn(page, "staff");
  await page.getByRole("link", { name: "Donations", exact: true }).click();
  await expect(page.getByRole("button", { name: "Save donation", exact: true })).toBeDisabled();
  await page.getByRole("combobox").selectOption("donor:Individual donor");
  await page.getByLabel("Received on", { exact: true }).fill("2026-10-14");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("combobox", { name: "Item 1", exact: true }).selectOption("black-beans");
  await page.getByRole("spinbutton", { name: "Quantity, item 1" }).fill("2");
  await page.getByLabel("Expires on, item 1", { exact: true }).fill("2027-01-01");
  await page.getByRole("textbox", { name: "Shelf or bin, item 1" }).fill("A2");
  await page.getByRole("button", { name: "Save donation", exact: true }).click();
  await expect(
    page.getByText("Donation saved. 2 units added to inventory.", { exact: true }),
  ).toBeVisible();
  const donation = (await readRecord(page, "panther-donations-v1"))[0];
  expect(donation).toMatchObject({ donor: "Individual donor", units: 2, lines: 1 });
  const beans = (await readRecord(page, "panther-inventory-v1")).find(
    (item) => item.id === "black-beans",
  );
  expect(beans.lots.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(50);
  expect(beans.lots).toContainEqual(
    expect.objectContaining({ quantity: 2, expiry: "2027-01-01", shelf: "A2" }),
  );
  await page.reload();
  expect((await readRecord(page, "panther-donations-v1"))[0]).toEqual(donation);
  await expect(page.getByRole("button", { name: "Save donation", exact: true })).toBeDisabled();
});

test("admin adds staff, filters reports, and paginates the audit log", async ({ page }) => {
  await signIn(page, "admin");
  await page.getByRole("link", { name: "Users", exact: true }).click();
  await page.getByRole("button", { name: "Add staff member", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").nth(0).fill("Browser Test Staff");
  await dialog.getByRole("textbox").nth(1).fill("browser.staff@pvamu.edu");
  await dialog.getByRole("button", { name: "Add staff member", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("row").filter({ hasText: "browser.staff@pvamu.edu" })).toContainText(
    "Active",
  );
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  const metrics = page.locator(".admin-metrics");
  const previous = await metrics.innerText();
  await page.getByRole("combobox", { name: "Report month" }).selectOption({ label: "August 2026" });
  await expect(metrics).not.toHaveText(previous);
  await expect(metrics).toContainText("118");
  await page.getByRole("link", { name: "Audit log", exact: true }).click();
  await page.getByRole("combobox", { name: "Audit date", exact: true }).selectOption("");
  await expect(page.getByRole("row").filter({ hasText: "Browser Test Staff" })).toContainText(
    "Account created",
  );
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Showing" })).toContainText(
    "Showing 9–16",
  );
});
