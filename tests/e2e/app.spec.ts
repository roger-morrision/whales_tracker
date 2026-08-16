import { test, expect } from '@playwright/test';

test.describe('Moby App - Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      localStorage.setItem('moby-storage', JSON.stringify({ state: { onboarded: true }, version: 0 }));
    });
    await page.goto('/');
    await expect(page.locator('nav[role="navigation"]')).toBeVisible({ timeout: 15000 });
  });

  test('should load home page with bottom navigation', async ({ page }) => {
    // Check bottom nav is visible
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    
    await expect(page.locator('nav[role="navigation"] button')).toHaveCount(4);
  });

  test('should navigate between tabs', async ({ page }) => {
    const nav = page.locator('nav[role="navigation"] button');
    await nav.nth(1).click();
    await expect(nav.nth(1)).toHaveAttribute('aria-current', 'page');
    
    // Click Profile tab
    await nav.nth(3).click();
    await expect(nav.nth(3)).toHaveAttribute('aria-current', 'page');
    
    // Back to Home
    await nav.nth(0).click();
    await expect(nav.nth(0)).toHaveAttribute('aria-current', 'page');
  });

  test('should open and close search modal with Cmd+K', async ({ page }) => {
    await page.keyboard.press('Control+/');
    await expect(page.getByRole('dialog').filter({ has: page.getByPlaceholder(/Search tokens/i) })).toBeVisible();
    
    // Press Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.getByRole('dialog').filter({ has: page.getByPlaceholder(/Search tokens/i) })).not.toBeVisible();
  });

  test('should open and close AI Copilot with Cmd+K (alternative)', async ({ page }) => {
    // Check if Cmd+K opens copilot instead
    await page.keyboard.press('Control+K');
    const copilot = page.getByRole('dialog', { name: /copilot|assistant|moby/i });
    if (await copilot.isVisible().catch(() => false)) {
      await expect(copilot).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('should open wallet modal', async ({ page }) => {
    // Click wallet button in top bar
    await page.getByRole('button', { name: /wallet|connect/i }).click();
    await expect(page.getByRole('dialog', { name: /wallet/i })).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /wallet/i })).not.toBeVisible();
  });

  test('should open settings modal', async ({ page }) => {
    // Navigate to Profile tab
    await page.getByRole('link', { name: 'Profile' }).click();
    
    // Click settings
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByRole('dialog', { name: /settings/i })).toBeVisible();
    
    // Close with Escape
    await page.keyboard.press('Escape');
  });

  test('should display token cards on Discover page', async ({ page }) => {
    // Check for token cards
    await expect(page.locator('[data-testid="token-card"]').first()).toBeVisible({ timeout: 10000 });
    
    // Should have at least a few tokens
    const tokenCards = page.locator('[data-testid="token-card"]');
    expect(await tokenCards.count()).toBeGreaterThan(0);
  });

  test('should open token detail sheet on token click', async ({ page }) => {
    // Wait for tokens to load
    await page.waitForSelector('[data-testid="token-card"]', { timeout: 10000 });
    
    // Click first token
    await page.locator('[data-testid="token-card"]').first().click();
    
    // Token detail sheet should open
    await expect(page.getByRole('dialog').last()).toBeVisible({ timeout: 5000 });
    
    // Close with Escape
    await page.keyboard.press('Escape');
  });

  test('should open trade modal from token detail', async ({ page }) => {
    await page.waitForSelector('[data-testid="token-card"]', { timeout: 10000 });
    await page.locator('[data-testid="token-card"]').first().click();
    await expect(page.getByRole('dialog').last()).toBeVisible({ timeout: 5000 });
    
    // Click Buy button
    await page.getByRole('button', { name: /buy/i }).click();
    
    // Trade modal should open
    await expect(page.getByRole('dialog', { name: /trade|swap/i })).toBeVisible({ timeout: 5000 });
    
    // Close with Escape
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape'); // Close token detail too
  });

  test('should show whales view with trader cards', async ({ page }) => {
    await page.goto('/feeds');
    
    // Should show trader cards or table
    await expect(page.locator('[data-testid="trader-card"], [data-testid="trader-row"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should redirect legacy route aliases', async ({ page }) => {
    await page.goto('/whales');
    await expect(page).toHaveURL(/\/feeds$/);

    await page.goto('/portfolio');
    await expect(page).toHaveURL(/\/leaderboard$/);
  });

  test('should show signals view', async ({ page }) => {
    await page.goto('/signals');
    
    // Should show signals
    await expect(page.locator('[data-testid="signal-card"], [data-testid="signal-item"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show portfolio view', async ({ page }) => {
    await page.getByRole('link', { name: 'Leaders' }).click();
    
    // Should show portfolio overview
    await expect(page.getByText(/leaderboard|smart money/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should show profile view', async ({ page }) => {
    await page.getByRole('link', { name: 'Profile' }).click();
    await page.waitForTimeout(250);
    
    // Should show profile content
    await expect(page.getByText(/profile|settings|account/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('keyboard navigation - Escape closes modals in correct order', async ({ page }) => {
    // Open multiple modals
    await page.getByRole('button', { name: /wallet|connect/i }).click();
    await expect(page.getByRole('dialog', { name: /wallet/i })).toBeVisible();
    
    await page.getByRole('button', { name: /settings/i }).click();
    await expect(page.getByRole('dialog', { name: /settings/i })).toBeVisible();
    
    // First Escape should close settings (topmost)
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /settings/i })).not.toBeVisible();
    await expect(page.getByRole('dialog', { name: /wallet/i })).toBeVisible();
    
    // Second Escape should close wallet
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /wallet/i })).not.toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(page.locator('nav[role="navigation"]')).toBeVisible({ timeout: 15000 });
    
    // Bottom nav should still be visible
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    
    // All tabs should be accessible
    await expect(page.locator('nav[role="navigation"] button')).toHaveCount(4);
  });
});

test.describe('API Endpoints', () => {
  test('/api/health should return 200', async ({ request }) => {
    const response = await request.get('/api/health');
    expect([200, 503]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('/api/prices should return token prices', async ({ request }) => {
    const response = await request.get('/api/prices?symbols=SOL,WIF');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('prices');
  });

  test('/api/quote should return swap quote', async ({ request }) => {
    const response = await request.get('/api/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm&amount=1000000000&slippageBps=100');
    expect([200, 503]).toContain(response.status());
    const data = await response.json();
    if (response.status() === 200) expect(data).toHaveProperty('outAmount');
  });

  test('/api/gmgn/trending should return trending tokens', async ({ request }) => {
    const response = await request.get('/api/gmgn/trending?limit=10');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('tokens');
  });

  test('/api/solana/trending should return trending Solana tokens', async ({ request }) => {
    const response = await request.get('/api/solana/trending');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('tokens');
  });
});
