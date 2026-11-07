/**
 * Smoke tests of the console, in a real browser, against a real backend: signing in and out, the dashboard, a list
 * opened in place and a resource's detail, a manifest page, and an LLMClient's workbench.
 *
 * The throwaway user owns nothing, so the tests open the platform's examples, which every platform's
 * initialize_platform loads and shares with every user: the lists' Shared tabs.
 */
import { expect, test, type Page } from "@playwright/test";

import { readTestUser } from "../backend";

/** Signs in as the throwaway user, from the sign-in page, and closes the welcome dialog of a first sign-in. */
async function signIn(page: Page): Promise<void> {
  const user = readTestUser();
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const welcome = page.getByRole("dialog");
  const close = welcome.getByRole("button", { name: "Close" });
  if (await close.isVisible({ timeout: 5000 }).catch(() => false)) await close.click();
}

/** The console's sidebar. */
function sidebar(page: Page) {
  return page.getByRole("navigation", { name: "Main" });
}

test.describe("the console", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("signs in to the dashboard, whose widgets load from the backend", async ({ page }) => {
    await expect(page.getByRole("banner").getByRole("heading", { level: 1 })).toBeVisible();
    const resources = page.getByRole("region", { name: "My Resources" });
    await expect(resources).toBeVisible();
    // the counts arrived: My Resources links each kind to its list.
    await expect(resources.getByRole("link").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Service Health" })).toBeVisible();
  });

  test("opens a list from the sidebar in place, and a shared resource's detail", async ({ page }) => {
    // a mark on the page's window, which a full page load would lose.
    await page.evaluate(() => Object.assign(window, { e2eSamePage: true }));
    await sidebar(page).getByRole("link", { name: "Guardrails" }).click();
    await expect(page).toHaveURL(/\/guardrail$/);
    expect(await page.evaluate(() => (window as Window & { e2eSamePage?: boolean }).e2eSamePage)).toBe(true);

    await page.getByRole("button", { name: "Shared Guardrails" }).click();
    const row = page.locator("tbody > tr:not(.ghost)").first();
    await expect(row).toBeVisible();
    const name = (await row.locator("td").first().innerText()).trim().split("\n")[0];
    await row.locator("td").first().click();
    const detail = page.getByRole("dialog", { name });
    await expect(detail).toBeVisible();
    await detail.getByRole("tab", { name: "Manifest" }).click();
    await expect(detail.getByText("kind: Guardrail")).toBeVisible();
  });

  test("opens a shared resource's manifest page, in its editor", async ({ page }) => {
    await sidebar(page).getByRole("link", { name: "Guardrails" }).click();
    await page.getByRole("button", { name: "Shared Guardrails" }).click();
    const edit = page.getByTitle("Edit: Open the YAML manifest that defines this guardrail resource").first();
    await edit.click();
    await expect(page).toHaveURL(/\/guardrail\/.+/);
    await expect(page.getByText("kind: Guardrail").first()).toBeVisible();
  });

  test("opens a shared LLMClient's workbench", async ({ page }) => {
    await sidebar(page).getByRole("link", { name: "LLM Clients" }).click();
    await page.getByRole("button", { name: /^Shared/ }).click();
    await page.getByRole("link", { name: "Workbench" }).first().click();
    await expect(page).toHaveURL(/\/workbench\/llm-clients\/.+\/prompt/);
    await expect(page.getByRole("region", { name: "Chat with your AI assistant" })).toBeVisible();
  });

  test("signs out, back to the sign-in page", async ({ page }) => {
    const user = readTestUser();
    await page.getByRole("button", { name: user.email }).click();
    await page.getByRole("button", { name: "Sign Out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});
