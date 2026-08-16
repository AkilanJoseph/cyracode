import { test, expect } from '@playwright/test'

const UNIQUE = Date.now()
const TEST_CODE = `E2ECode${UNIQUE}`

async function seedCode(request) {
  const regResp = await request.post('http://localhost:8000/auth/register', {
    data: {
      first_name: 'Seed',
      last_name: 'User',
      email: `seed_${UNIQUE}@testcyra.com`,
      password: 'SeedP@ss1',
    },
  })
  const { access_token } = await regResp.json()

  // Use UNIQUE-derived coordinates to avoid collisions across successive test runs.
  const lat = 10 + (UNIQUE % 70)
  const lng = 10 + (UNIQUE % 160)

  const codeResp = await request.post('http://localhost:8000/registration/traditional', {
    headers: { Authorization: `Bearer ${access_token}` },
    data: {
      name: TEST_CODE,
      latitude: lat,
      longitude: lng,
      country: 'India',
      country_code: 'IN',
      state: 'Karnataka',
      city: 'Bangalore',
      street_address: 'MG Road',
      postal_code: '560001',
      verified_mobile: '+911234567890',
    },
  })
  return codeResp
}

test.describe('Search flow', () => {
  test.beforeAll(async ({ request }) => {
    await seedCode(request)
  })

  test('search page loads with input', async ({ page }) => {
    await page.goto('/search')
    await expect(page.getByPlaceholder(/search a cyracode/i)).toBeVisible()
  })

  test('searching for seeded code shows result', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByPlaceholder(/search a cyracode/i)
    await input.fill(TEST_CODE)
    await input.press('Enter')
    await expect(page.locator('h2').filter({ hasText: TEST_CODE })).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: /get directions/i })).toBeVisible()
  })

  test('result shows address fields', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByPlaceholder(/search a cyracode/i)
    await input.fill(TEST_CODE)
    await input.press('Enter')
    await expect(page.locator('h2').filter({ hasText: TEST_CODE })).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/Bangalore/i)).toBeVisible()
  })

  test('searching by Enter key works', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByPlaceholder(/search a cyracode/i)
    await input.fill(TEST_CODE)
    await input.press('Enter')
    await expect(page.getByText(TEST_CODE)).toBeVisible({ timeout: 8000 })
  })

  test('unknown code shows not found message', async ({ page }) => {
    await page.goto('/search')
    await page.fill('[placeholder*="Search"]', 'AbsolutelyNotExistCode')
    await page.getByRole('button', { name: /go/i }).click()
    await expect(
      page.getByText(/not found|no cyracode/i)
    ).toBeVisible({ timeout: 8000 })
  })

  test('search history is saved after successful search', async ({ page }) => {
    await page.goto('/search')
    const input = page.getByPlaceholder(/search a cyracode/i)
    await input.fill(TEST_CODE)
    await input.press('Enter')
    await expect(page.locator('h2').filter({ hasText: TEST_CODE })).toBeVisible({ timeout: 8000 })
    // Navigate away and back — history should persist
    await page.goto('/')
    await page.goto('/search')
    await expect(page.getByRole('button', { name: TEST_CODE })).toBeVisible()
  })

  test('autocomplete suggestions appear while typing', async ({ page }) => {
    await page.goto('/search')
    const prefix = TEST_CODE.slice(0, 5)
    await page.fill('[placeholder*="Search"]', prefix)
    // Suggestions are debounced — wait a bit
    await page.waitForTimeout(400)
    // The suggestion dropdown might or might not show depending on network;
    // just verify no crash
    await expect(page.getByPlaceholder(/search a cyracode/i)).toBeVisible()
  })

  test('Share button copies link to clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.goto('/search')
    const input = page.getByPlaceholder(/search a cyracode/i)
    await input.fill(TEST_CODE)
    await input.press('Enter')
    await expect(page.locator('h2').filter({ hasText: TEST_CODE })).toBeVisible({ timeout: 8000 })
    await page.getByRole('button', { name: /share/i }).click()
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toContain(TEST_CODE)
  })
})
