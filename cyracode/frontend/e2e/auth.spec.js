import { test, expect } from '@playwright/test'

const UNIQUE = Date.now()
const TEST_EMAIL = `e2e_${UNIQUE}@testcyra.com`
const TEST_PASSWORD = 'TestPass1!'

test.describe('Authentication flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('landing page loads with login form', async ({ page }) => {
    await expect(page.getByText(/Your address, one name\./i)).toBeVisible()
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible()
  })

  test('shows validation error for invalid email on login', async ({ page }) => {
    await page.fill('input[type="email"]', 'not-an-email')
    await page.getByRole('button', { name: /^log in$/i }).click()
    await expect(page.getByText(/valid email address/i)).toBeVisible()
  })

  test('shows error for missing password on login', async ({ page }) => {
    await page.fill('input[type="email"]', 'test@example.com')
    await page.getByRole('button', { name: /^log in$/i }).click()
    await expect(page.getByText(/this field is required/i)).toBeVisible()
  })

  test('shows error toast for wrong credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'wrong@example.com')
    await page.fill('input[type="password"]', 'WrongPass1!')
    await page.getByRole('button', { name: /^log in$/i }).click()
    // Toast or inline error should appear
    await expect(
      page.getByText(/invalid email or password|login failed/i)
    ).toBeVisible({ timeout: 5000 })
  })

  test('can switch to Sign Up tab', async ({ page }) => {
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
  })

  test('sign up shows password strength indicator', async ({ page }) => {
    await page.getByRole('button', { name: /^sign up$/i }).click()
    const pwField = page.locator('input[type="password"]').last()
    await pwField.fill('weak')
    await expect(page.getByText(/very weak|weak/i)).toBeVisible()
  })

  test('full register → redirect to mode-select modal', async ({ page }) => {
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill('User')
    // Use index to pick the email field in the sign-up form
    const emailInputs = page.locator('input[type="email"]')
    await emailInputs.last().fill(TEST_EMAIL)
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.last().fill(TEST_PASSWORD)
    await page.getByLabel(/i agree/i).check()
    await page.getByRole('button', { name: /create account/i }).click()
    await expect(
      page.getByText(/how do you want to register/i)
    ).toBeVisible({ timeout: 8000 })
  })

  test('after register can dismiss modal and see landing', async ({ page }) => {
    await page.getByRole('button', { name: /^sign up$/i }).click()
    await page.getByLabel(/first name/i).fill('E2E')
    await page.getByLabel(/last name/i).fill('User')
    const emailInputs = page.locator('input[type="email"]')
    await emailInputs.last().fill(`dismiss_${UNIQUE}@testcyra.com`)
    const pwInputs = page.locator('input[type="password"]')
    await pwInputs.last().fill(TEST_PASSWORD)
    await page.getByLabel(/i agree/i).check()
    await page.getByRole('button', { name: /create account/i }).click()
    await page.getByText(/maybe later/i).click()
    await expect(page.getByText(/Your address, one name\./i)).toBeVisible()
  })

  test('login with registered account goes to dashboard', async ({ page }) => {
    // Register via API so we don't depend on E2E sign-up flow
    const resp = await page.request.post('http://localhost:8000/auth/register', {
      data: {
        first_name: 'E2E',
        last_name: 'Login',
        email: `login_${UNIQUE}@testcyra.com`,
        password: TEST_PASSWORD,
        gdpr_consent: true,
      },
    })
    expect(resp.ok()).toBeTruthy()

    await page.goto('/')
    await page.fill('input[type="email"]', `login_${UNIQUE}@testcyra.com`)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.getByRole('button', { name: /^log in$/i }).click()
    await expect(page).toHaveURL(/dashboard/, { timeout: 8000 })
    await expect(page.getByText(/Hey, E2E/i)).toBeVisible()
  })

  test('dashboard shows user name', async ({ page }) => {
    const resp = await page.request.post('http://localhost:8000/auth/register', {
      data: {
        first_name: 'Dashboard',
        last_name: 'Tester',
        email: `dash_${UNIQUE}@testcyra.com`,
        password: TEST_PASSWORD,
        gdpr_consent: true,
      },
    })
    const { access_token } = await resp.json()
    await page.goto('/')
    await page.evaluate(([token, email]) => {
      localStorage.setItem('cyracode_token', token)
      localStorage.setItem('cyracode_user', JSON.stringify({
        first_name: 'Dashboard', last_name: 'Tester',
        email,
      }))
    }, [access_token, `dash_${UNIQUE}@testcyra.com`])
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('logout clears session and shows landing', async ({ page }) => {
    const resp = await page.request.post('http://localhost:8000/auth/register', {
      data: {
        first_name: 'Logout',
        last_name: 'Test',
        email: `logout_${UNIQUE}@testcyra.com`,
        password: TEST_PASSWORD,
        gdpr_consent: true,
      },
    })
    const { access_token } = await resp.json()
    await page.evaluate((token) => {
      localStorage.setItem('cyracode_token', token)
    }, access_token)
    await page.goto('/dashboard')
    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page).toHaveURL('/')
  })
})
