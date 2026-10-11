import { test, expect } from '@playwright/test';

// Base URL comes from playwright.config.ts (use.baseURL) — all paths below are relative.
// Tests start logged in: the 'setup' project (tests/auth.setup.js) saves the session as storageState.

const CUSTOMER = {
  name:  'Test User',
  email: 'testuser@example.com',
  phone: '9876543210',
};

// Same format the app uses for prices (en-US, USD, no decimals)
const fmtPrice = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Books an event from the events page and stays on the confirmation card.
 * @param {object}  [opts]
 * @param {string}  [opts.eventTitle] book this event; defaults to the first non-sold-out card
 * @param {number}  [opts.quantity=1] tickets to book (set with the + button)
 * @returns {{ bookingRef: string, eventTitle: string, booking: object }} booking = API response data
 */
async function bookEvent(page, { eventTitle, quantity = 1 } = {}) {
  await page.goto('/events');

  // Sold-out cards keep the book-now-btn test id but read "Sold Out" — match on the label too
  let card = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn').filter({ hasText: 'Book Now' }),
  });
  if (eventTitle) card = card.filter({ hasText: eventTitle });
  card = card.first();
  await expect(card).toBeVisible();

  // Capture title before navigating away
  const title = (await card.getByRole('heading').textContent())?.trim() ?? '';
  console.log(`Booking event: "${title}" x${quantity}`);

  await card.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  // Set quantity
  for (let i = 1; i < quantity; i++) {
    await page.getByRole('button', { name: '+', exact: true }).click();
  }
  await expect(page.locator('#ticket-count')).toHaveText(String(quantity));

  // Fill booking form and capture the API response for exact values (id, totalPrice)
  await page.getByLabel('Full Name').fill(CUSTOMER.name);
  await page.locator('#customer-email').fill(CUSTOMER.email);
  await page.getByPlaceholder('+91 98765 43210').fill(CUSTOMER.phone);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
  );
  await page.locator('.confirm-booking-btn').click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const booking = (await response.json()).data;

  // Wait for confirmation card
  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toHaveText(booking.bookingRef);
  console.log(`Booking confirmed. Ref: ${booking.bookingRef}, id: ${booking.id}`);
  return { bookingRef: booking.bookingRef, eventTitle: title, booking };
}

/**
 * Creates a user event through the Admin UI and returns its title.
 * Counts toward the 6-event sandbox limit (oldest is pruned automatically).
 */
async function createEvent(page, title) {
  // datetime-local wants local "YYYY-MM-DDTHH:mm"; 30 days ahead keeps it in the future
  const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const eventDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;

  await page.goto('/admin/events');
  await page.locator('#event-title-input').fill(title);
  await page.getByLabel('City').fill('Bangalore');
  await page.getByLabel('Venue').fill('Test Venue');
  await page.getByLabel('Event Date & Time').fill(eventDate);
  await page.getByLabel('Price ($)').fill('150');
  await page.getByLabel('Total Seats').fill('50');
  await page.locator('#add-event-btn').click();
  await expect(page.getByText('Event created!')).toBeVisible();
  console.log(`Created event: "${title}"`);
  return title;
}

/**
 * Clears all bookings. Safe to call when already empty — the button is always
 * rendered and clearing an empty list succeeds.
 */
async function clearBookings(page) {
  await page.goto('/bookings');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Management — Critical Happy Paths', () => {

  // TC-011 ───────────────────────────────────────────────────────────────────
  test('TC-011: displays booking card on bookings list page', async ({ page }) => {
    // -- Step 1: Clear state, create one booking --
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to /bookings --
    await page.goto('/bookings');

    // -- Step 3: Assert booking card appears with correct data --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(bookingRef);
  });

  // TC-012 ───────────────────────────────────────────────────────────────────
  test('TC-012: shows all sections on booking detail page', async ({ page }) => {
    // -- Step 1: Clear state, book 2 tickets (so total ≠ price per ticket) --
    await clearBookings(page);
    const { bookingRef, eventTitle, booking } = await bookEvent(page, { quantity: 2 });

    // -- Step 2: Navigate to /bookings and click View Details --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}$`));

    // -- Step 3: Verify breadcrumb shows booking ref --
    await expect(page.getByRole('navigation').getByText(bookingRef)).toBeVisible();

    // -- Step 4: Verify event details section --
    await expect(page.getByText('Event Details')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(eventTitle);

    // -- Step 5: Verify customer details values --
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText(CUSTOMER.name, { exact: true })).toBeVisible();
    await expect(page.getByText(CUSTOMER.email, { exact: true })).toBeVisible();
    await expect(page.getByText(CUSTOMER.phone, { exact: true })).toBeVisible();

    // -- Step 6: Verify payment summary — Total Paid = price × 2 (from the API) --
    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();
    const pricePerTicket = Number(booking.event.price);
    expect(Number(booking.totalPrice)).toBe(pricePerTicket * 2);
    await expect(page.getByText(fmtPrice(pricePerTicket), { exact: true })).toBeVisible();
    await expect(page.getByText(fmtPrice(booking.totalPrice), { exact: true })).toBeVisible();

    // -- Step 7: Verify booking id and refund eligibility check button --
    await expect(page.getByText(`#${booking.id}`, { exact: true })).toBeVisible();
    await expect(page.locator('#check-refund-btn')).toBeVisible();
  });

  // TC-010 ───────────────────────────────────────────────────────────────────
  test('TC-010: navigates to bookings list after booking via View My Bookings link', async ({ page }) => {
    // -- Step 1: Clear state --
    await clearBookings(page);

    // -- Step 2: Book the first available event (ends on the confirmation card) --
    const { bookingRef } = await bookEvent(page);

    // -- Step 3: Click "View My Bookings" link on confirmation card --
    await page.getByRole('link', { name: 'View My Bookings' }).click();
    await expect(page).toHaveURL(/\/bookings$/);

    // -- Step 4: Assert the new booking appears in the list --
    const bookingCard = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(bookingCard).toBeVisible();
  });

  // TC-103 + TC-104 ──────────────────────────────────────────────────────────
  test('TC-103: booking reference starts with first letter of event title (uppercase)', async ({ page }) => {
    // -- Step 1: Create an event whose title starts with a random lowercase letter --
    // A fresh letter each run tests the rule beyond one seeded title, and lowercase checks uppercasing (TC-104)
    const letter = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    const eventTitle = await createEvent(page, `${letter}ref test ${Date.now()}`);

    // -- Step 2: Clear state and book the new event --
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page, { eventTitle });

    // -- Step 3: Assert ref is <UPPERCASE LETTER>-<6 alphanumerics> --
    const expectedPrefix = letter.toUpperCase();
    expect(bookingRef).toMatch(new RegExp(`^${expectedPrefix}-[A-Z0-9]{6}$`));
    console.log(`Ref "${bookingRef}" correctly starts with "${expectedPrefix}-" (event: "${eventTitle}")`);
  });

  // TC-013 ───────────────────────────────────────────────────────────────────
  test('TC-013: cancels booking from detail page — shows toast and redirects', async ({ page }) => {
    // -- Step 1: Clear state, create one booking --
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page);

    // -- Step 2: Navigate to booking detail via View Details --
    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click Cancel Booking button on detail page --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: Assert React confirmation dialog appears --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    await expect(page.locator('#confirm-dialog-yes')).toBeVisible();

    // -- Step 5: Confirm cancellation --
    await page.locator('#confirm-dialog-yes').click();

    // -- Step 6: Assert redirect to /bookings and success toast --
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 7: Assert booking is no longer in the list --
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

  // TC-015 ───────────────────────────────────────────────────────────────────
  test('TC-015: clears all bookings and shows empty state', async ({ page }) => {
    // -- Step 1: Clear state, create one booking --
    await clearBookings(page);
    await bookEvent(page);

    // -- Step 2: Navigate to /bookings and verify booking exists --
    await page.goto('/bookings');
    await expect(page.getByTestId('booking-card').first()).toBeVisible();

    // -- Step 3: Click "Clear all bookings" and accept browser confirm dialog --
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /clear all bookings/i }).click();

    // -- Step 4: Assert empty state --
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Browse Events' })).toBeVisible();
  });

});
