import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const fixture = JSON.parse(await readFile(process.env.PANTRY_CONNECTED_FIXTURES, "utf8"));
async function login(page, account, workspace) {
  await page.goto("/");
  await page.getByLabel("Workspace").selectOption(workspace);
  await page.getByLabel("University email").fill(account.email);
  await page.getByLabel("Password", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}
async function tab(page, name) {
  await page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
}
test("real browser journey: donate, request, approve, verify ID, distribute, refresh, report, sign out", async ({
  browser,
}) => {
  const staffContext = await browser.newContext();
  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staff = await staffContext.newPage(),
    student = await studentContext.newPage();
  await login(staff, fixture.admin, "admin");
  await tab(staff, "Donations");
  await staff.getByLabel("Donor", { exact: true }).fill("Browser donation");
  await staff.getByRole("button", { name: "Add line" }).click();
  await staff.getByLabel("Item 1", { exact: true }).selectOption(fixture.browserItem);
  await staff.getByLabel("Quantity 1", { exact: true }).fill("2");
  await staff.getByLabel("Storage 1", { exact: true }).fill("Test shelf");
  await staff.getByRole("button", { name: "Receive donation" }).click();
  await expect(staff.getByRole("status")).toContainText("Donation received");
  await login(student, fixture.browserStudent, "student");
  await student.getByLabel(fixture.category, { exact: true }).check();
  await student.getByLabel("Pickup slot").selectOption(fixture.browserSlot);
  await student.getByRole("button", { name: "Reserve pickup" }).click();
  await expect(student.getByRole("status")).toHaveText("Request submitted.");
  await student.reload();
  await expect(student.getByRole("cell", { name: "submitted", exact: true })).toBeVisible();
  await tab(staff, "Requests");
  await staff.getByRole("button", { name: "Refresh", exact: true }).click();
  const row = staff.getByRole("row").filter({ hasText: fixture.browserStudent.name });
  await row.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(row.getByRole("cell", { name: "approved", exact: true })).toBeVisible();
  await student.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(student.getByRole("cell", { name: "approved", exact: true })).toBeVisible();
  await tab(staff, "Students");
  const section = staff.locator("section").filter({
    has: staff.getByRole("heading", { name: fixture.browserStudent.name, exact: true }),
  });
  await section.getByLabel("Student ID", { exact: true }).fill("BROWSER-TEST-ID");
  await section.getByLabel("Physical ID checked").check();
  await section.getByRole("button", { name: "Verify student ID" }).click();
  await expect(section.getByText("BROWSER-TEST-ID", { exact: true })).toBeVisible();
  await tab(staff, "Requests");
  await staff
    .getByRole("row")
    .filter({ hasText: fixture.browserStudent.name })
    .getByRole("button", { name: "Complete pickup" })
    .click();
  await staff.getByLabel("I checked the student's physical ID").check();
  await staff.getByRole("button", { name: "Add line" }).click();
  await staff.getByLabel("Item 1", { exact: true }).selectOption(fixture.browserItem);
  await staff.getByLabel("Quantity 1", { exact: true }).fill("1");
  await staff.getByRole("button", { name: "Complete pickup", exact: true }).click();
  await expect(staff.getByRole("status")).toContainText("Pickup completed");
  await student.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(student.getByRole("cell", { name: "completed", exact: true })).toBeVisible();
  await tab(staff, "Inventory");
  await expect(staff.getByRole("row").filter({ hasText: "Browser item" })).toContainText("1 / 1");
  await staff.screenshot({
    path: test.info().outputPath("connected-inventory.png"),
    fullPage: true,
  });
  await student.screenshot({
    path: test.info().outputPath("connected-student-mobile.png"),
    fullPage: true,
  });
  await tab(staff, "Reports");
  await expect(staff.getByText("distributed", { exact: true })).toBeVisible();
  await tab(staff, "Audit");
  await expect(
    staff.getByRole("cell", { name: "complete_pickup", exact: true }).first(),
  ).toBeVisible();
  await student.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(student.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await student.reload();
  await expect(student.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
  await staffContext.close();
  await studentContext.close();
});

async function inboxLink(email, subject) {
  let message;
  await expect
    .poll(async () => {
      const inbox = await fetch("http://127.0.0.1:54324/api/v1/messages").then((r) => r.json());
      message = inbox.messages.find(
        (m) => m.To.some((t) => t.Address === email) && subject.test(m.Subject),
      );
      return Boolean(message);
    })
    .toBe(true);
  const details = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`).then((r) =>
    r.json(),
  );
  return (details.HTML || details.Text)
    .match(/https?:[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/)[0]
    .replaceAll("&amp;", "&");
}

test("browser registration confirms email and follows password recovery link", async ({ page }) => {
  const email = `${fixture.run}-browser-signup@pvamu.edu`,
    password = crypto.randomUUID() + "Aa1!";
  await page.goto("/");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Full name").fill("Browser signup");
  await page.getByLabel("University email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your university email");
  await page.goto(await inboxLink(email, /confirm/i));
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await page.getByLabel("University email").fill(email);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await inboxLink(email, /reset/i));
  await expect(page.getByRole("heading", { name: "Set your password", exact: true })).toBeVisible();
  const newPassword = crypto.randomUUID() + "Aa1!";
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Set password", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Password updated.");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await login(page, { email, password: newPassword }, "student");
});

test("admin creates a private invitation and staff sets a password in the browser", async ({
  browser,
  page,
}) => {
  await login(page, fixture.admin, "admin");
  await tab(page, "Users");
  const email = `${fixture.run}-browser-staff@pvamu.edu`,
    password = crypto.randomUUID() + "Aa1!";
  await page.getByLabel("Staff email", { exact: true }).fill(email);
  await page.getByLabel("Full name", { exact: true }).fill("Browser invited staff");
  await page.getByRole("button", { name: "Create staff invitation", exact: true }).click();
  const invitation = page.getByLabel("Private staff invitation", { exact: true });
  await expect(invitation).toBeVisible();
  const context = await browser.newContext(),
    staff = await context.newPage();
  await staff.goto(await invitation.inputValue());
  await expect(
    staff.getByRole("heading", { name: "Set your password", exact: true }),
  ).toBeVisible();
  await staff.getByLabel("New password", { exact: true }).fill(password);
  await staff.getByRole("button", { name: "Set password", exact: true }).click();
  await expect(staff.getByRole("status")).toHaveText("Password updated.");
  await staff.getByRole("button", { name: "Sign out", exact: true }).click();
  await login(staff, { email, password }, "staff");
  await context.close();
});

test("wrong workspace and network failure cannot show a successful write", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Workspace").selectOption("admin");
  await page.getByLabel("University email").fill(fixture.browserStudent.email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.browserStudent.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("workspace");
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await login(page, fixture.admin, "admin");
  await tab(page, "Inventory");
  await page.getByLabel("Item name", { exact: true }).fill("Must not save");
  await page.getByLabel("Category", { exact: true }).fill("Test");
  await page.route("**/rest/v1/inventory_items*", (route) => route.abort());
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Must not save" })).toHaveCount(0);
});
