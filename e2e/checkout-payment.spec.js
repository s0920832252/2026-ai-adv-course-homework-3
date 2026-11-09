const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('登入、下單、完成綠界網路 ATM 付款並返回商店', async ({ page }) => {
  const response = await page.request.get('/');
  expect(response.ok(), 'localhost:3001 must already be running').toBeTruthy();

  await page.goto('/login');
  await page.getByPlaceholder('請輸入 Email').fill('admin@hexschool.com');
  await page.getByPlaceholder('請輸入密碼').fill('12345678');
  await page.locator('form').getByRole('button', { name: '登入', exact: true }).click();
  await expect(page).toHaveURL(/localhost:3001\/$/);

  const cartAdded = page.waitForResponse(response => response.url().includes('/api/cart') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '加入購物車' }).first().click();
  expect((await cartAdded).ok()).toBeTruthy();
  await page.goto('/cart');
  await page.getByRole('button', { name: '前往結帳' }).click();
  await expect(page.getByRole('heading', { name: '結帳' })).toBeVisible();
  await page.getByPlaceholder('請輸入收件人姓名').fill('E2E 測試收件人');
  await page.getByPlaceholder('請輸入 Email').fill('e2e-recipient@example.com');
  await page.getByPlaceholder('請輸入收件地址').fill('台北市測試路 100 號');
  await page.getByRole('button', { name: '確認送出訂單' }).click();
  await expect(page).toHaveURL(/ecpay\.com|ecpay\.tw/i, { timeout: 60000 });

  await page.getByRole('listitem', { name: 'WebATM' }).click();
  const webAtmTab = page.locator('#liWebATM');
  await webAtmTab.locator('div').click();
  await expect(webAtmTab).toHaveClass(/active/);
  const webAtmBank = page.locator('#selWebATMBank');
  await expect(webAtmBank).toBeVisible();
  await webAtmBank.selectOption({ label: '台灣土地銀行' });
  page.once('dialog', dialog => dialog.accept());
  const bankPagePromise = page.context().waitForEvent('page', { timeout: 10000 }).catch(() => null);
  await page.getByRole('link', { name: '前往付款' }).click();
  const closeHint = page.getByRole('button', { name: '關閉', exact: true });
  if (await closeHint.isVisible().catch(() => false)) await closeHint.click();
  const bankPage = await bankPagePromise || page;
  await bankPage.waitForLoadState('domcontentloaded').catch(() => {});
  await expect(bankPage.getByRole('button', { name: /^Save$/i })).toBeVisible({ timeout: 60000 });
  await bankPage.getByRole('button', { name: /^Save$/i }).click();
  await expect(bankPage.getByText(/付款成功|交易成功/)).toBeVisible({ timeout: 120000 });
  await bankPage.getByRole('link', { name: '返回商店' }).click();

  await expect(bankPage).toHaveURL(/\/orders\//);
  await expect(bankPage.getByText('已付款', { exact: true })).toBeVisible({ timeout: 60000 });
  const orderId = new URL(bankPage.url()).pathname.split('/').filter(Boolean).pop();
  const token = await bankPage.evaluate(() => localStorage.getItem('flower_token'));
  const orderResponse = await bankPage.request.get(`/api/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  expect(orderResponse.ok()).toBeTruthy();
  expect((await orderResponse.json()).data.status).toBe('paid');

  const screenshotPath = path.join(__dirname, '..', 'artifacts', 'e2e-payment-success.png');
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await bankPage.screenshot({ path: screenshotPath, fullPage: true });
});
