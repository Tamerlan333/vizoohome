// NOT YET RUN: needs `npm install`, `npx playwright install chromium`, and a working .env.local (Sanity project id).
import { test, expect } from "@playwright/test";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440];
const toggle = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /Ətraflı Axtarış|Advanced search|Расширенный поиск/ });
test("panel is collapsed first, opens and closes, keeps main fields", async ({ page }) => {
  await page.goto("/"); await expect(toggle(page)).toHaveAttribute("aria-expanded", "false"); await expect(page.locator("#adv-panel input").first()).not.toBeVisible();
  await page.getByLabel(/Min\. qiymət/).fill("100"); await toggle(page).click(); await expect(toggle(page)).toHaveAttribute("aria-expanded", "true"); await expect(page).toHaveURL(/\/$/);
  await toggle(page).click(); await expect(page.getByLabel(/Min\. qiymət/)).toHaveValue("100"); });
test("pills, exclusive top options, invalid range message, URL", async ({ page }) => {
  await page.goto("/"); await toggle(page).click();
  await page.getByRole("radio", { name: "Təmirli" }).click(); await expect(page.getByRole("radio", { name: "Təmirli" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Ən üst olmasın" }).click(); await page.getByRole("button", { name: "Yalnız ən üst" }).click();
  await expect(page.getByRole("button", { name: "Ən üst olmasın" })).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Sahə (m²) min.").fill("150"); await page.getByLabel("Sahə (m²) maks.").fill("60"); await expect(page.getByRole("alert").filter({ hasText: /Minimum/ })).toBeVisible();
  await page.getByLabel("Sahə (m²) maks.").fill("200"); await page.getByRole("button", { name: /^(Axtar|Search|Найти)$/ }).click();
  await expect(page).toHaveURL(/repair=repaired/); await expect(page).toHaveURL(/minArea=150/); await expect(page).toHaveURL(/topFloorOnly=true/); await expect(page).not.toHaveURL(/excludeTopFloor/); });
for (const w of WIDTHS) test(`expanded panel has no horizontal overflow at ${w}px`, async ({ page }) => {
  await page.setViewportSize({ width: w, height: 800 }); await page.goto("/"); await toggle(page).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false); });
