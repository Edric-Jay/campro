import { expect, test } from "@playwright/test";

test("captures a still and opens it from the gallery", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("status")).toHaveText(/live/i, { timeout: 20_000 });
  const shutter = page.getByTestId("control-shutter");
  await expect(shutter).toContainText(/partial|unavailable/i);
  await expect(page.getByTestId("pro-panel")).toContainText(/unavailable/i);
  await page.getByTestId("shutter").click();
  await expect(page.getByTestId("last-capture").locator("img")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("last-capture").click();
  await expect(page.getByTestId("capture-card").first()).toBeVisible();
  await page.getByTestId("capture-card").first().getByRole("link").click();
  await expect(page.getByTestId("review-title")).toBeVisible();
});
