import { test, expect, signIn, fixturePassword } from "./pantry-fixture.js";

test("keyboard sign-in and password dialog dismissal use connected Auth", async ({
  page,
  pantry,
}) => {
  await page.goto("/#/sign-in");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@pvamu.edu");
  const help = page.getByRole("button", { name: "Forgot password?" });
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Reset your password" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(help).toBeFocused();
  await page.locator('input[name="password"]').fill(fixturePassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hi, Jordan", exact: true })).toBeVisible();
  expect(pantry.state.calls.some((c) => c.path === "/auth/v1/token")).toBe(true);
});

test("invalid credentials, refresh persistence, and logout protect the workspace", async ({
  page,
  pantry,
}) => {
  await page.goto("/#/sign-in");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@pvamu.edu");
  await page.locator('input[name="password"]').fill("Incorrect-password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Email or password is incorrect/)).toBeVisible();
  await signIn(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Hi, Jordan", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Your profile and sign out" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/#/student/home");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  expect(pantry.state.calls.some((c) => c.path === "/auth/v1/logout")).toBe(true);
});

async function choosePickup(page) {
  await page.getByRole("button", { name: "Request food", exact: true }).click();
  await page.getByRole("button", { name: "Canned beans", exact: true }).click();
  await page.locator(".student-days button").first().click();
  await page.getByRole("radio").first().check();
}
test("student reserves and cancels through the hosted request RPC contracts", async ({
  page,
  pantry,
}) => {
  await signIn(page);
  await choosePickup(page);
  await page.getByLabel("Dietary note (optional)").fill("No pork");
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Request submitted");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  expect(pantry.state.calls.find((c) => c.path.endsWith("/submit_food_request")).body).toEqual({
    p_slot_id: pantry.ids.slot,
    p_item_id: pantry.ids.item,
    p_note: "No pork",
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your request is waiting for approval" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel request", exact: true }).click();
  await page.getByRole("button", { name: "Yes, cancel request", exact: true }).click();
  await expect(page.getByText("You have no open request.", { exact: true })).toBeVisible();
  expect(pantry.state.calls.find((c) => c.path.endsWith("/cancel_food_request")).body).toEqual({
    p_request_id: pantry.state.requests[0].id,
  });
  expect(pantry.state.booked).toBe(0);
});

test("an API-rejected reservation displays the error without a successful write", async ({
  page,
  pantry,
}) => {
  pantry.state.failRequest = true;
  await signIn(page);
  await choosePickup(page);
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(
    page.getByText("This pickup time is full. Choose another time.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(pantry.state.requests).toHaveLength(0);
  expect(pantry.state.calls.filter((c) => c.path.endsWith("/submit_food_request"))).toHaveLength(1);
});

test.describe("mobile connected pages", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const fits = async (page) =>
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  test("student home, selection, and history fit the viewport", async ({ page }) => {
    await signIn(page);
    await fits(page);
    await choosePickup(page);
    await fits(page);
    await page.getByRole("link", { name: "History", exact: true }).click();
    await fits(page);
  });
  test("closed staff navigation stays out of focus and Escape closes it", async ({ page }) => {
    await signIn(page, "staff");
    const opener = page.getByRole("button", { name: "Open navigation", exact: true }),
      sidebar = page.locator("#workspace-navigation");
    await expect(sidebar).toBeHidden();
    await opener.focus();
    await page.keyboard.press("Tab");
    expect(await sidebar.evaluate((el) => el.contains(document.activeElement))).toBe(false);
    await opener.click();
    await expect(sidebar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await page.getByRole("link", { name: "Donations", exact: true }).click();
    await expect(sidebar).toBeHidden();
    await fits(page);
  });
});

test("staff approval sends the decision RPC and refreshes requests", async ({ page, pantry }) => {
  pantry.state.requests = [pantry.request()];
  await signIn(page, "staff");
  await page.getByRole("link", { name: /^Requests/ }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.getByText("Jordan Ellis's request approved.", { exact: true })).toBeVisible();
  expect(pantry.state.calls.find((c) => c.path.endsWith("/staff_decide_request")).body).toEqual({
    p_request_id: pantry.state.requests[0].id,
    p_approve: true,
    p_reason: null,
  });
  expect(pantry.state.requests[0].status).toBe("approved");
});

test("donations send existing-item lines and refresh stock", async ({ page, pantry }) => {
  await signIn(page, "staff");
  await page.getByRole("link", { name: "Donations", exact: true }).click();
  await page.getByRole("combobox").first().selectOption("donor:Community donor");
  await page.getByLabel("Received on", { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("combobox", { name: "Item 1", exact: true }).selectOption(pantry.ids.item);
  await page.getByRole("spinbutton", { name: "Quantity, item 1" }).fill("2");
  await page.getByLabel("Expires on, item 1", { exact: true }).fill("2099-01-01");
  await page.getByRole("combobox", { name: "Shelf or bin, item 1" }).selectOption("A1-1");
  await page.getByRole("button", { name: "Save donation", exact: true }).click();
  await expect(
    page.getByText("Donation saved. 2 units added to inventory.", { exact: true }),
  ).toBeVisible();
  expect(
    pantry.state.calls.find((c) => c.path.endsWith("/staff_record_donation")).body.p_lines,
  ).toEqual([
    { item_id: pantry.ids.item, quantity: 2, expiry_date: "2099-01-01", storage_location: "A1-1" },
  ]);
  await page.reload();
  await expect(page.getByRole("button", { name: /^Community donor/ })).toBeVisible();
  expect(pantry.state.stock).toBe(6);
});

test("admin reports refetch the selected month and export API totals", async ({ page, pantry }) => {
  await signIn(page, "admin");
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByRole("combobox", { name: "Report month" }).selectOption("2026-01");
  await expect(page.locator(".admin-metrics").getByText("2", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("panther-pantry-report-2026-01.csv");
  expect(
    pantry.state.calls.some(
      (c) => c.path.endsWith("/admin_monthly_report") && c.body.p_month === "2026-01-01",
    ),
  ).toBe(true);
});

async function requestReset(page, pantry) {
  await page.goto("/#/sign-in");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  const dialog = page.getByRole("dialog", { name: "Reset your password" });
  await dialog.getByRole("textbox", { name: "Email", exact: true }).fill("student@pvamu.edu");
  await page.getByRole("button", { name: "Send reset link", exact: true }).click();
  await expect(dialog).toContainText("Open the link on this device.");
  const sent = pantry.state.calls.find((c) => c.path === "/auth/v1/recover");
  expect(new URL(`https://fixture.invalid/${sent.query}`).searchParams.get("redirect_to")).toBe(
    "http://127.0.0.1:4173/?pantry_recovery=1",
  );
  expect(sent.body.code_challenge_method).toBe("s256");
  expect(pantry.state.challenge).toBeTruthy();
}

test("walk-in requires ID confirmation, completes through the distribution RPC, and clears stale selection", async ({
  page,
  pantry,
}) => {
  await signIn(page, "staff");
  await page.getByRole("link", { name: "Walk-in", exact: true }).click();
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
  await page.getByRole("combobox").selectOption(pantry.ids.item);
  await page.getByRole("spinbutton").fill("1");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Complete pickup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today's pickups", exact: true })).toBeVisible();
  const calls = pantry.state.calls.filter((c) => c.path.endsWith("/staff_complete_distribution"));
  expect(calls).toHaveLength(1);
  expect(calls[0].body).toEqual({
    p_request_id: null,
    p_profile_id: pantry.ids.student,
    p_provisional_student_id: null,
    p_items: [{ item_id: pantry.ids.item, quantity: 1 }],
    p_id_checked: true,
  });
  expect(pantry.state.stock).toBe(3);
  await page.goto("/#/staff/distribution");
  await expect(
    page.getByRole("heading", { name: "No pickup selected", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Complete pickup", exact: true })).toHaveCount(0);
  expect(
    pantry.state.calls.filter((c) => c.path.endsWith("/staff_complete_distribution")),
  ).toHaveLength(1);
});

test("a student cannot stay signed in through the staff portal", async ({ page, pantry }) => {
  await page.goto("/#/staff/sign-in");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("student@pvamu.edu");
  await page.locator('input[name="password"]').fill(fixturePassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("This is a student account. Use the student sign-in instead.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toHaveCount(0);
  expect(pantry.state.calls.some((c) => c.path === "/auth/v1/logout")).toBe(true);
});
test("recovery exchanges PKCE, survives reload, validates confirmation, and clears its marker", async ({
  page,
  pantry,
}) => {
  await requestReset(page, pantry);
  await page.goto("/?code=fixture-recovery-code&pantry_recovery=1");
  await expect(
    page.getByRole("heading", { name: "Choose a new password", exact: true }),
  ).toBeVisible();
  expect(
    pantry.state.calls.find((c) => c.path === "/auth/v1/token" && c.query.includes("pkce")).body
      .auth_code,
  ).toBe("fixture-recovery-code");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose a new password", exact: true }),
  ).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("FixtureNewPassword!2026");
  await page.getByLabel("Confirm new password", { exact: true }).fill("DifferentPassword!2026");
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect(page.getByText("The two passwords don't match.", { exact: true })).toBeVisible();
  expect(
    pantry.state.calls.filter((c) => c.path === "/auth/v1/user" && c.method === "PUT"),
  ).toHaveLength(0);
  await page.getByLabel("Confirm new password", { exact: true }).fill("FixtureNewPassword!2026");
  await page.getByRole("button", { name: "Save new password", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Hi, Jordan", exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.has("pantry_recovery")).toBe(false);
  expect(
    pantry.state.calls.find((c) => c.path === "/auth/v1/user" && c.method === "PUT").body,
  ).toMatchObject({ password: "FixtureNewPassword!2026" });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Choose a new password", exact: true }),
  ).toHaveCount(0);
});
test("an expired recovery code cannot unlock the password form", async ({ page, pantry }) => {
  await requestReset(page, pantry);
  pantry.state.expiredCode = true;
  await page.goto("/?code=expired-code&pantry_recovery=1");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose a new password", exact: true }),
  ).toHaveCount(0);
  expect(
    pantry.state.calls.filter((c) => c.path === "/auth/v1/user" && c.method === "PUT"),
  ).toHaveLength(0);
});
