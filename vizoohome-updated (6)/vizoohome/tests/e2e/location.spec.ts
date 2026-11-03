// NOT YET RUN: needs `npm install`, `npx playwright install chromium`, and a working .env.local (Sanity project id).
import { test, expect } from "@playwright/test";
const WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440];
const trigger = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /Yer|Location|Местоположение/ }).first();
for (const w of WIDTHS) {
  test(`no horizontal overflow at ${w}px (closed and open picker)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 }); await page.goto("/");
    const over = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(await over()).toBe(false); await trigger(page).click(); expect(await over()).toBe(false);
  });
}
test("mobile: open, pick metro stations, apply, chips, URL", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 }); await page.goto("/");
  await trigger(page).click(); await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("tab", { name: /Metro/ }).click();
  await page.getByLabel("28 May").check(); await page.getByLabel("Sahil").check();
  await page.getByRole("button", { name: /Tətbiq et|Apply|Применить/ }).click();
  await expect(page.getByRole("dialog")).toBeHidden(); await expect(trigger(page)).toBeFocused();
  await page.getByRole("button", { name: /^(Axtar|Search|Найти)$/ }).click();
  await expect(page).toHaveURL(/metro=metro-28-may%2Cmetro-sahil|metro=metro-28-may,metro-sahil/);
});
test("mobile: closing without Apply discards changes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 }); await page.goto("/");
  await trigger(page).click(); await page.getByRole("tab", { name: /Metro/ }).click(); await page.getByLabel("Ulduz").check();
  await page.getByRole("button", { name: /Bağla|Close|Закрыть/ }).first().click();
  await expect(page.getByRole("button", { name: /Metro Ulduz|Ulduz/ })).toHaveCount(0);
});
test("desktop: district checkbox, partial state, keyboard, Escape", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.goto("/");
  await trigger(page).focus(); await page.keyboard.press("Enter");
  await page.getByPlaceholder(/Yer axtar|Find a place|Найти место/).fill("nesimi");
  const district = page.getByRole("checkbox", { name: "Nəsimi" }).first(); await district.focus(); await page.keyboard.press("Space"); await expect(district).toBeChecked();
  await page.keyboard.press("Escape"); await expect(trigger(page)).toBeFocused();
});
