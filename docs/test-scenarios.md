# EventHub — Booking Application Test Scenarios

Generated: 2026-10-11
Scope: The end-to-end booking application: auth, browsing events, booking tickets, managing bookings, refund eligibility, admin-created events as booking targets, sandbox limits and cross-user isolation.
Sources: `eventhub-domain` skill (SKILL.md, business-rules.md, user-flows.md, api-reference.md, ui-selectors.md), `frontend/app/**`, `frontend/components/**`, `frontend/lib/**`, `backend/src/{services,validators,repositories,middleware,routes}/**`, `backend/prisma/seed.js`.
Previous version (booking management only) is kept as `docs/test-scenarios.2026-03-06.bak.md`.

> **Read Appendix A first.** Several behaviours in the code differ from the domain skill (status codes, seed data, FIFO ordering). Scenarios below assert what the **code** does where that is the intended behaviour, and are tagged `⚠ Discrepancy` where the code and the documentation disagree. Those need a product decision before automating.

## Coverage Summary

| Area | Happy | Business Rule | Security | Negative | Edge | UI State |
|---|---|---|---|---|---|---|
| Auth (register/login/session) | 001–003 | — | 200–205 | 300–304 | 400 | 500 |
| Browse & filter events | 004–006 | 100–102 | 206 | 305 | 401–403 | 501–504 |
| Book tickets | 007–010 | 103–112 | 207–211 | 306–318 | 404–416 | 505–512 |
| Manage bookings | 011–015 | 113–117 | 212–217 | 319–323 | 417–421 | 513–522 |
| Refund eligibility | 016–017 | 118–119 | — | — | 422 | 523–524 |
| Events as booking targets (admin) | 018–019 | 120–124 | 218–220 | 324–326 | 423–424 | 525 |

Total: 143 scenarios (Happy 19, Business Rule 25, Security 21, Negative 27, Edge 25, UI State 26).

---

## Happy Path (TC-001 – TC-099)

### TC-001: Register a new account and land on home
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Email `qa+<timestamp>@test.com` is not registered
**Steps**:
1. Navigate to `/register`
2. Enter the unique email and a password of 6+ characters
3. Submit the form
**Expected Results**: `POST /api/auth/register` returns `{ token, user: { id, email } }`; `eventhub_token` is stored in localStorage; user is redirected to `/`; navbar shows logged-in state
**Business Rule**: Flow 1 — Registration; JWT issued on register
**Suggested Layer**: E2E

### TC-002: Log in with a valid account
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Seeded user `rahulshetty1@gmail.com` exists
**Steps**:
1. Navigate to `/login`
2. Fill email and password
3. Click `#login-btn`
**Expected Results**: Token stored as `eventhub_token`; redirect to `/`; protected pages (`/events`, `/bookings`) load without redirect
**Business Rule**: Flow 1 — Login; JWT (7-day expiry)
**Suggested Layer**: E2E

### TC-003: Log out clears the session
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User is logged in
**Steps**:
1. Click Logout in the navbar
2. Navigate directly to `/bookings`
**Expected Results**: `eventhub_token` removed from localStorage; user is sent to `/login`; `/bookings` redirects to `/login` (AuthGuard)
**Business Rule**: `useAuth.logout`, `AuthGuard` public paths are only `/login`, `/register`
**Suggested Layer**: E2E

### TC-004: Browse the events list
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged in; static events seeded
**Steps**:
1. Click "Browse Events →" on home or navigate to `/events`
**Expected Results**: Event cards (`data-testid="event-card"`) render with title, date, venue/city, price, seat indicator and "Book Now"; static events show the "Featured" badge
**Business Rule**: Flow 2; static events shared across all users
**Suggested Layer**: E2E

### TC-005: Search events by title, description and venue
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Logged in
**Steps**:
1. On `/events`, type a word that appears only in one event's title
2. Repeat with a word only in a description, then a word only in a venue
**Expected Results**: After the 300ms debounce, URL gains `?search=`; only matching events are listed in each case; `page` param is reset
**Business Rule**: Flow 2 — search covers title, description, venue (`eventRepository.findAll`)
**Suggested Layer**: API (matching logic) + E2E (one smoke case)

### TC-006: Filter events by category and city
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Logged in; events exist in more than one category/city
**Steps**:
1. Pick "Conference" in the category dropdown
2. Pick a city in the city dropdown
3. Click "Clear filters"
**Expected Results**: URL reflects `category`/`city`; only events matching both filters are shown; "Clear filters" resets the URL to `/events` and shows all events
**Business Rule**: Flow 2 — category and city filters
**Suggested Layer**: E2E

### TC-007: Book a single ticket for a static event
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged in; a static event with available seats
**Steps**:
1. On `/events`, click "Book Now" on the event card
2. On `/events/:id`, keep quantity at 1
3. Fill Full Name, Email (`#customer-email`), Phone (`+91 98765 43210` placeholder)
4. Click Confirm Booking (`.confirm-booking-btn`)
**Expected Results**: `POST /api/bookings` returns 201 with `message: "Booking confirmed!"`; confirmation card shows "Booking Confirmed! 🎉", `.booking-ref`, customer name, tickets = 1, total = price × 1
**Business Rule**: Flow 3 — Book an Event
**Suggested Layer**: E2E

### TC-008: Book multiple tickets using the + / − controls
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged in; event with ≥ 3 available seats
**Steps**:
1. Open the event detail page
2. Click "+" twice, then "−" once, then "+" once (expect 3)
3. Fill the customer form and confirm
**Expected Results**: `#ticket-count` updates on each click; price summary shows `$price × 3 tickets` and Total = price × 3; confirmation shows Tickets = 3 and the matching total
**Business Rule**: Quantity 1–10; `totalPrice = price × quantity`
**Suggested Layer**: E2E

### TC-009: Book a user-created (dynamic) event
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Logged in; user created an event via `/admin/events` or `POST /api/events`
**Steps**:
1. Open the created event from `/events`
2. Book 2 tickets
**Expected Results**: Booking succeeds; event detail/list now shows `availableSeats = totalSeats − 2` for this user
**Business Rule**: Per-user seat availability for dynamic events
**Suggested Layer**: E2E

### TC-010: Navigate from confirmation to My Bookings and back to events
**Category**: Happy Path
**Priority**: P1
**Preconditions**: A booking was just confirmed (TC-007)
**Steps**:
1. Click "View My Bookings"
2. Go back to the event and confirm another booking, then click "Browse More Events"
**Expected Results**: "View My Bookings" opens `/bookings` with the new booking at the top (sorted by `createdAt desc`); "Browse More Events" opens `/events`
**Business Rule**: Business rules §1 — post-booking navigation
**Suggested Layer**: E2E

### TC-011: View the bookings list
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has ≥ 1 booking
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: Each `#booking-card` shows booking ref, "confirmed" badge, `#booking-id`, event title, event date, ticket count (singular/plural), city, booked date, total, "View Details" and "Cancel Booking"
**Business Rule**: Flow 4 — Manage Bookings
**Suggested Layer**: E2E

### TC-012: View booking details
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has ≥ 1 booking
**Steps**:
1. On `/bookings`, click "View Details"
**Expected Results**: `/bookings/:id` shows breadcrumb with the ref, `h1` = event title, Event Details (title, category, date, venue, city), Customer Details (name, email, phone), Payment Summary (tickets, price per ticket, Total Paid), Refund section, Booking Information (booked on, `#id`)
**Business Rule**: Flow 4 step 3–4
**Suggested Layer**: E2E

### TC-013: Cancel a booking from the detail page
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has a booking
**Steps**:
1. Open `/bookings/:id`
2. Click "Cancel Booking", then "Yes, cancel it"
**Expected Results**: Dialog says "Cancelling <ref> will release <qty> seat(s)…"; `DELETE /api/bookings/:id` returns 200 "Booking cancelled"; toast "Booking cancelled successfully"; redirect to `/bookings`; booking is gone
**Business Rule**: Flow 4 step 6; cancellation frees seats
**Suggested Layer**: E2E

### TC-014: Cancel a booking from the list card
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User has ≥ 2 bookings
**Steps**:
1. On `/bookings`, click `#cancel-booking-btn` on one card and confirm
**Expected Results**: Toast shown; the card disappears; the other booking(s) remain; user stays on `/bookings`
**Business Rule**: Flow 4 step 6
**Suggested Layer**: E2E

### TC-015: Clear all bookings
**Category**: Happy Path
**Priority**: P0
**Preconditions**: User has ≥ 2 bookings
**Steps**:
1. On `/bookings`, click "Clear all bookings"
2. Accept the browser `confirm()` dialog
**Expected Results**: `DELETE /api/bookings` returns 200 with `"<n> booking(s) cleared"`; empty state "No bookings yet" is shown
**Business Rule**: §4 — "Clear All Bookings" removes all in one action
**Suggested Layer**: E2E

### TC-016: Refund check — single-ticket booking is eligible
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Booking with quantity = 1
**Steps**:
1. Open `/bookings/:id`
2. Click `#check-refund-btn`
**Expected Results**: `#refund-spinner` appears, then `#refund-result` shows "Eligible for refund. Single-ticket bookings qualify for a full refund."
**Business Rule**: §8 — quantity = 1 is refundable
**Suggested Layer**: E2E (or Component with fake timers)

### TC-017: Refund check — group booking is not eligible
**Category**: Happy Path
**Priority**: P0
**Preconditions**: Booking with quantity = 3
**Steps**:
1. Open `/bookings/:id` and click `#check-refund-btn`
**Expected Results**: After the spinner, `#refund-result` shows "Not eligible for refund. Group bookings (3 tickets) are non-refundable."
**Business Rule**: §8 — quantity > 1 is non-refundable
**Suggested Layer**: E2E (or Component with fake timers)

### TC-018: Create an event in Admin and book it
**Category**: Happy Path
**Priority**: P1
**Preconditions**: Logged in
**Steps**:
1. Navigate to `/admin/events` (or "Add New Event" on `/events`)
2. Fill `#event-title-input`, category, City, Venue, Event Date & Time (future), Price ($), Total Seats; click `#add-event-btn`
3. Find the event on `/events` and book 1 ticket
**Expected Results**: Toast "Event created!"; event appears on `/events` without the "Featured" badge; booking succeeds and the ref starts with the title's first letter
**Business Rule**: Flow 5; §1 — users can create events
**Suggested Layer**: E2E

### TC-019: Delete own event removes its bookings
**Category**: Happy Path
**Priority**: P1
**Preconditions**: User owns a dynamic event with ≥ 1 booking
**Steps**:
1. On `/admin/events`, click `#delete-event-btn` for the event and confirm "Delete event"
2. Open `/bookings`
**Expected Results**: Toast "Event deleted"; the event's bookings no longer appear (cascade delete)
**Business Rule**: Booking.eventId cascades on Event delete
**Suggested Layer**: API (cascade) + E2E smoke

---

## Business Rules (TC-100 – TC-199)

### TC-100: Static events are visible to every user
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Two users (Gmail, Yahoo test accounts)
**Steps**:
1. As each user, `GET /api/events`
**Expected Results**: Both responses contain the same set of `isStatic: true` events
**Business Rule**: §2 — static events are shared across users
**Suggested Layer**: API

### TC-101: Dynamic events are visible only to their owner
**Category**: Business Rule
**Priority**: P0
**Preconditions**: User A created event E
**Steps**:
1. As user B, `GET /api/events` and `GET /api/events/:E`
**Expected Results**: E is absent from B's list; `GET /api/events/:E` returns 404 for B
**Business Rule**: §2 — sandbox isolation
**Suggested Layer**: API

### TC-102: Events are ordered static first, then newest dynamic
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has ≥ 2 dynamic events
**Steps**:
1. `GET /api/events`
**Expected Results**: All `isStatic: true` events come first; dynamic events follow in `createdAt` descending order
**Business Rule**: `eventRepository.findAll` `orderBy: [{ isStatic: 'desc' }, { createdAt: 'desc' }]`
**Suggested Layer**: API

### TC-103: Booking reference first letter equals event title first letter
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Events whose titles start with different letters (e.g. "World Tech Summit", "Dilli Diwali Mela")
**Steps**:
1. Book each event
**Expected Results**: Ref for "World Tech Summit" starts `W-`, for "Dilli Diwali Mela" starts `D-`; whole ref matches `/^[A-Z0-9]-[A-Z0-9]{6}$/`
**Business Rule**: §7 — `[FIRST_LETTER]-[6_RANDOM_ALPHANUMERIC]`
**Suggested Layer**: API (many titles) + E2E (one)

### TC-104: Booking reference prefix is uppercased for lowercase titles
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User creates event titled "zumba night"
**Steps**:
1. Book the event
**Expected Results**: Ref starts with `Z-`
**Business Rule**: §7 — first letter (uppercase)
**Suggested Layer**: API

### TC-105: Total price equals price × quantity
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Event with known price (e.g. $1500)
**Steps**:
1. Book quantity 4 via API
**Expected Results**: `totalPrice` = 6000; UI confirmation, list card and detail "Total Paid" all show $6,000
**Business Rule**: §9 — `totalPrice = price × quantity`
**Suggested Layer**: API + E2E
**Note**: the price is taken from the event server-side, not the request (see TC-210)

### TC-106: Seat count drops immediately after booking (dynamic event)
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Own dynamic event with totalSeats = 50, no bookings
**Steps**:
1. Book 5 tickets
2. `GET /api/events/:id` and reload `/events`
**Expected Results**: `availableSeats` = 45 in API and on the event card
**Business Rule**: §6 — computed as `totalSeats − sum(user's quantities)`
**Suggested Layer**: API + E2E

### TC-107: Seat count drops for the booking user on a static event, not for others
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Static event with availableSeats = N; users A and B have no bookings on it
**Steps**:
1. User A books 3 tickets
2. A and B each call `GET /api/events/:id`
**Expected Results**: A sees N − 3; B still sees N
**Business Rule**: §6 — per-user availability (`withPersonalSeats` applies to all events)
**Suggested Layer**: API

### TC-108: Same user can book the same event repeatedly
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Event with ≥ 4 seats
**Steps**:
1. Book 2 tickets, then 2 more for the same event
**Expected Results**: Two separate bookings with different refs; available seats reduced by 4 in total
**Business Rule**: §6 — "allows the same user to book the same event multiple times"
**Suggested Layer**: API

### TC-109: Cancelling a booking restores seats
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Dynamic event, totalSeats = 20; user booked 5 (available = 15)
**Steps**:
1. `DELETE /api/bookings/:id`
2. `GET /api/events/:id`
**Expected Results**: availableSeats back to 20
**Business Rule**: §4 — cancellation immediately frees seats
**Suggested Layer**: API

### TC-110: Booking limit — 10th booking prunes the oldest (different event preferred)
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Bookings cleared; user makes 9 bookings across ≥ 2 events, noting the oldest booking ID for an event other than the target
**Steps**:
1. Create a 10th booking for event X
2. `GET /api/bookings?limit=20`
**Expected Results**: Total stays at 9; the oldest booking whose `eventId ≠ X` is gone; the new booking exists
**Business Rule**: §4 — max 9, FIFO; code prefers a different event (`findOldestUserBookingExcludingEvent`)
**Suggested Layer**: API

### TC-111: Booking limit — all 9 bookings on the same event (fallback)
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Bookings cleared; 9 bookings of qty 1 on event X; record X's availableSeats as seen by the user (S)
**Steps**:
1. Book X again with qty 1
2. `GET /api/events/:X`
**Expected Results**: Total stays at 9; the oldest X booking is deleted; the user still sees S − 1 seats because the code permanently decrements `availableSeats` on the event row by 1. ⚠ Discrepancy A-5: this burned seat is never restored, and for a static event it is lost for all users
**Business Rule**: §4 FIFO + `sameEventFallback` in `bookingService.createBooking`
**Suggested Layer**: API

### TC-112: Each booking reference is unique
**Category**: Business Rule
**Priority**: P2
**Preconditions**: —
**Steps**:
1. Create 9 bookings, clear, repeat several times; collect all refs
**Expected Results**: No duplicate refs; DB unique constraint holds
**Business Rule**: §7 — unique via collision retry (10 attempts, then timestamp fallback)
**Suggested Layer**: Unit (mock `findByRef` to always collide → fallback `X-<base36>`) + API
**Note**: the fallback ref is up to 8 characters, so it breaks the 6-character format

### TC-113: Bookings list shows only the user's own bookings
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Users A and B each have bookings
**Steps**:
1. As A, `GET /api/bookings`
**Expected Results**: Every returned booking has `userId = A`
**Business Rule**: §2 — sandbox isolation
**Suggested Layer**: API

### TC-114: Bookings list is newest first
**Category**: Business Rule
**Priority**: P2
**Preconditions**: ≥ 3 bookings made in sequence
**Steps**:
1. `GET /api/bookings` and open `/bookings`
**Expected Results**: Order is `createdAt` descending in both
**Business Rule**: `bookingRepository.findAll` `orderBy createdAt desc`
**Suggested Layer**: API

### TC-115: Booking status is always "confirmed"
**Category**: Business Rule
**Priority**: P1
**Preconditions**: —
**Steps**:
1. Create a booking with `"status": "cancelled"` in the body
**Expected Results**: 201; `status` = "confirmed"
**Business Rule**: Booking model — status always "confirmed"
**Suggested Layer**: API

### TC-116: Clear all deletes only the current user's bookings
**Category**: Business Rule
**Priority**: P0
**Preconditions**: A and B both have bookings
**Steps**:
1. As A, `DELETE /api/bookings`
2. As B, `GET /api/bookings`
**Expected Results**: A has 0; B's bookings are unchanged
**Business Rule**: §2 isolation; `deleteAllForUser(userId)`
**Suggested Layer**: API

### TC-117: Clear all restores seats on the affected events
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User booked 3 + 2 seats on two dynamic events
**Steps**:
1. `DELETE /api/bookings`
2. `GET /api/events/:id` for both
**Expected Results**: Both events back to totalSeats
**Business Rule**: §4, §6
**Suggested Layer**: API

### TC-118: Refund result depends only on quantity
**Category**: Business Rule
**Priority**: P1
**Preconditions**: Bookings with qty 1, 2 and 10
**Steps**:
1. Check refund on each
**Expected Results**: qty 1 → eligible; qty 2 and 10 → "Group bookings (N tickets) are non-refundable" with the right N
**Business Rule**: §8
**Suggested Layer**: Component

### TC-119: Refund check makes no API call
**Category**: Business Rule
**Priority**: P3
**Preconditions**: Booking detail open
**Steps**:
1. Record network requests; click `#check-refund-btn`; wait for the result
**Expected Results**: No request goes to the backend
**Business Rule**: §8 — frontend-only logic
**Suggested Layer**: E2E

### TC-120: Event limit — 7th event prunes the oldest
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 6 dynamic events
**Steps**:
1. Create a 7th event
**Expected Results**: Still 6 dynamic events; the oldest is gone, along with any bookings on it
**Business Rule**: §3 — max 6, FIFO
**Suggested Layer**: API

### TC-121: FIFO event pruning silently removes bookings
**Category**: Business Rule
**Priority**: P1
**Preconditions**: User has 6 events; has a booking on the oldest
**Steps**:
1. Create a 7th event
2. `GET /api/bookings`
**Expected Results**: The booking on the pruned event is gone (cascade); there is no warning in the UI beyond the sandbox banner
**Business Rule**: §3 + cascade delete
**Suggested Layer**: API

### TC-122: Static events are not counted toward the 6-event limit
**Category**: Business Rule
**Priority**: P2
**Preconditions**: User has 5 dynamic events
**Steps**:
1. Create one more event
**Expected Results**: 6 dynamic events, none pruned
**Business Rule**: §3
**Suggested Layer**: API

### TC-123: Static events cannot be edited or deleted
**Category**: Business Rule
**Priority**: P0
**Preconditions**: Static event ID
**Steps**:
1. `PUT /api/events/:id` with a valid body
2. `DELETE /api/events/:id`
**Expected Results**: 403 "Cannot modify a static event" and 403 "Cannot delete a static event"; the admin UI shows no Edit/Delete buttons for static events
**Business Rule**: §3
**Suggested Layer**: API + E2E (button absence)

### TC-124: Changing an event's price does not change existing bookings
**Category**: Business Rule
**Priority**: P2
**Preconditions**: Own event at $100; booking of qty 2 ($200)
**Steps**:
1. `PUT` the event with price 150
2. `GET /api/bookings/:id`
**Expected Results**: Booking `totalPrice` still 200; Payment Summary shows "Price per ticket $150" but "Total Paid $200". Decide whether the detail page should show the price at booking time
**Business Rule**: totalPrice stored at booking time
**Suggested Layer**: API

---

## Security (TC-200 – TC-299)

### TC-200: Protected pages redirect anonymous users to login
**Category**: Security
**Priority**: P0
**Preconditions**: Fresh context, no token
**Steps**:
1. Visit `/`, `/events`, `/events/1`, `/bookings`, `/bookings/1`, `/admin/events`
**Expected Results**: Each redirects to `/login`; no protected content flashes
**Business Rule**: `AuthGuard`
**Suggested Layer**: E2E

### TC-201: Booking and event APIs reject missing token
**Category**: Security
**Priority**: P0
**Preconditions**: —
**Steps**:
1. Call every `/api/bookings*` and `/api/events*` route without `Authorization`
**Expected Results**: 401 `{ error: "Unauthorized" }`
**Business Rule**: API errors — Missing auth token → 401
**Suggested Layer**: API

### TC-202: Tampered or expired JWT is rejected
**Category**: Security
**Priority**: P0
**Preconditions**: Valid token
**Steps**:
1. Change one character of the signature; call `GET /api/bookings`
2. Sign a token with the wrong secret; call again
3. Use a token with `exp` in the past
**Expected Results**: 401 "Invalid or expired token" in all cases
**Business Rule**: `authMiddleware` `jwt.verify`
**Suggested Layer**: API

### TC-203: Non-Bearer authorization schemes are rejected
**Category**: Security
**Priority**: P2
**Preconditions**: Valid token
**Steps**:
1. Send `Authorization: <token>` (no prefix), then `Authorization: bearer <token>` (lowercase)
**Expected Results**: 401 "Unauthorized" for both
**Business Rule**: `header.startsWith('Bearer ')`
**Suggested Layer**: API

### TC-204: Invalid stored token logs the user out in the UI
**Category**: Security
**Priority**: P1
**Preconditions**: localStorage `eventhub_token` set to garbage
**Steps**:
1. Load `/bookings`
**Expected Results**: `/api/auth/me` fails; token removed; redirect to `/login`
**Business Rule**: `useAuth` mount check; axios 401 interceptor
**Suggested Layer**: E2E

### TC-205: Passwords are never returned by the API
**Category**: Security
**Priority**: P1
**Preconditions**: —
**Steps**:
1. Register, log in, call `/api/auth/me`, and fetch a booking that includes the user relation if any
**Expected Results**: No `password` field (hashed or plain) appears in any response
**Business Rule**: bcrypt hashing; `authService` returns `{ id, email }`
**Suggested Layer**: API

### TC-206: Search input is not injectable
**Category**: Security
**Priority**: P2
**Preconditions**: Logged in
**Steps**:
1. `GET /api/events?search=' OR 1=1 --` and `?search=%`
**Expected Results**: 200 with only literal matches (normally none); no other users' dynamic events are leaked
**Business Rule**: §2 isolation; Prisma parameterised queries
**Suggested Layer**: API

### TC-207: Cannot book another user's dynamic event
**Category**: Security
**Priority**: P0
**Preconditions**: User A owns event E
**Steps**:
1. As B, `POST /api/bookings` with `eventId: E`
**Expected Results**: 404 "Event with id E not found"; no booking is created. ⚠ If B already had 9 bookings, check A-4: B's oldest booking is still pruned
**Business Rule**: §2; `eventRepository.findById(id, userId)`
**Suggested Layer**: API

### TC-208: Cross-user booking detail shows Access Denied
**Category**: Security
**Priority**: P0
**Preconditions**: A has booking ID X
**Steps**:
1. Log in as B (clear localStorage first) and navigate to `/bookings/X`
**Expected Results**: "Access Denied" heading with "You are not authorized to view this booking."; no booking data is rendered
**Business Rule**: Flow 6; §2 — 403 Access Denied
**Suggested Layer**: E2E

### TC-209: Cross-user booking APIs return 403
**Category**: Security
**Priority**: P0
**Preconditions**: A has booking X with ref R
**Steps**:
1. As B, `GET /api/bookings/X`
2. As B, `GET /api/bookings/ref/R`
**Expected Results**: 403 for both ("You are not authorized to view this booking" / "You do not own this booking"); response body contains no booking fields
**Business Rule**: §2 — cross-user access returns 403
**Suggested Layer**: API

### TC-210: Client cannot set price, owner, ref or status (mass assignment)
**Category**: Security
**Priority**: P0
**Preconditions**: Logged in as A; B's user ID known
**Steps**:
1. `POST /api/bookings` with a valid body plus `totalPrice: 1`, `userId: <B>`, `bookingRef: "HACK01"`, `status: "cancelled"`
**Expected Results**: 201; `totalPrice` = event.price × qty; `userId` = A; ref is generated; status "confirmed"
**Business Rule**: §9; service builds the record explicitly
**Suggested Layer**: API

### TC-211: Customer fields are rendered as text, not HTML
**Category**: Security
**Priority**: P1
**Preconditions**: —
**Steps**:
1. Book with name `<img src=x onerror=alert(1)>` (valid length)
2. View the confirmation, `/bookings` and `/bookings/:id`
**Expected Results**: The string is shown literally; no dialog fires; no injected element is in the DOM
**Business Rule**: React output escaping
**Suggested Layer**: E2E

### TC-212: Cannot cancel another user's booking
**Category**: Security
**Priority**: P0
**Preconditions**: A has booking X
**Steps**:
1. As B, `DELETE /api/bookings/X`
2. As A, `GET /api/bookings/X`
**Expected Results**: B gets an error; A's booking still exists. ⚠ Discrepancy A-3: code returns **404** "Booking with id X not found" (domain skill implies 403)
**Business Rule**: §2
**Suggested Layer**: API

### TC-213: Clear-all cannot target another user
**Category**: Security
**Priority**: P1
**Preconditions**: A and B have bookings
**Steps**:
1. As A, `DELETE /api/bookings?userId=<B>` and with body `{ userId: B }`
**Expected Results**: Only A's bookings are deleted; B is untouched
**Business Rule**: userId comes from the JWT only
**Suggested Layer**: API

### TC-214: Bookings list filters cannot leak other users' data
**Category**: Security
**Priority**: P1
**Preconditions**: B has bookings on static event S
**Steps**:
1. As A (no bookings on S), `GET /api/bookings?eventId=S`
**Expected Results**: Empty `data`, `total: 0`
**Business Rule**: §2 — `where: { userId }`
**Suggested Layer**: API

### TC-215: Booking IDs are enumerable but not readable
**Category**: Security
**Priority**: P2
**Preconditions**: A has booking X
**Steps**:
1. As B, request `GET /api/bookings/{X-5..X+5}`
**Expected Results**: Every result is 403 or 404, never 200 for another user's booking. Note that 403 vs 404 reveals whether an ID exists (information disclosure); log it for product review
**Business Rule**: §2
**Suggested Layer**: API

### TC-216: Cross-user booking access after re-login in the same browser
**Category**: Security
**Priority**: P1
**Preconditions**: A viewed booking X (cached by React Query)
**Steps**:
1. Log out A, log in B in the same tab without reloading
2. Navigate to `/bookings` and `/bookings/X`
**Expected Results**: B sees only B's bookings and "Access Denied" for X; no data from A's cache is shown
**Business Rule**: §2; React Query cache across logins
**Suggested Layer**: E2E

### TC-217: Booking ref lookup does not reveal other users' bookings
**Category**: Security
**Priority**: P2
**Preconditions**: A's ref R
**Steps**:
1. As B, `GET /api/bookings/ref/R` and `GET /api/bookings/ref/<random ref>`
**Expected Results**: 403 for R, 404 for a non-existent ref. Note the existence disclosure as in TC-215
**Business Rule**: §2
**Suggested Layer**: API

### TC-218: Cannot edit or delete another user's event
**Category**: Security
**Priority**: P0
**Preconditions**: A owns event E
**Steps**:
1. As B, `PUT /api/events/E` and `DELETE /api/events/E`
**Expected Results**: 404 (event is invisible to B); E and its bookings are unchanged
**Business Rule**: §2; scoped `findById`
**Suggested Layer**: API

### TC-219: Client cannot create a static event
**Category**: Security
**Priority**: P1
**Preconditions**: —
**Steps**:
1. `POST /api/events` with `isStatic: true`, `userId: null`
**Expected Results**: Event is created with `isStatic: false` and `userId` = caller; it is not visible to other users
**Business Rule**: §3; service hardcodes `isStatic: false`
**Suggested Layer**: API

### TC-220: Deleting another user's event cannot cascade into their bookings
**Category**: Security
**Priority**: P2
**Preconditions**: A owns E; A booked E
**Steps**:
1. As B, `DELETE /api/events/E`
2. As A, `GET /api/bookings`
**Expected Results**: A's booking on E is still present
**Business Rule**: §2
**Suggested Layer**: API

---

## Negative / Error (TC-300 – TC-399)

### TC-300: Register with an email that already exists
**Category**: Negative
**Priority**: P1
**Preconditions**: Email already registered
**Steps**:
1. `POST /api/auth/register` with the same email; also submit the register form
**Expected Results**: Error "Email already registered" shown in the UI; no token stored. ⚠ Discrepancy A-1: code returns **400**, domain skill says 409
**Business Rule**: Flow 1 — unique email
**Suggested Layer**: API + E2E

### TC-301: Login with a wrong password or unknown email
**Category**: Negative
**Priority**: P0
**Preconditions**: —
**Steps**:
1. Log in with a valid email and a wrong password
2. Log in with an unregistered email
**Expected Results**: Same generic message for both ("Invalid email or password", so no account enumeration); stays on `/login`. ⚠ Discrepancy A-2: code returns **400** with that message; domain skill says 401 "Invalid credentials"
**Business Rule**: API error table
**Suggested Layer**: API + E2E

### TC-302: Register/login with an invalid email format
**Category**: Negative
**Priority**: P2
**Preconditions**: —
**Steps**:
1. Submit `abc`, `abc@`, `a b@c.com`, empty
**Expected Results**: 400 "Validation failed" with `{ field: "email", message: "A valid email is required" }`
**Business Rule**: `validateAuth`
**Suggested Layer**: API

### TC-303: Register with a password shorter than 6 characters
**Category**: Negative
**Priority**: P1
**Preconditions**: —
**Steps**:
1. Register with a 5-character password
**Expected Results**: 400; `{ field: "password", message: "Password must be at least 6 characters" }`; no user created
**Business Rule**: Flow 1 — min 6 chars
**Suggested Layer**: API

### TC-304: Login form with empty fields
**Category**: Negative
**Priority**: P2
**Preconditions**: —
**Steps**:
1. Click `#login-btn` with both fields empty
**Expected Results**: Validation message shown; no navigation; no token stored
**Business Rule**: Flow 1
**Suggested Layer**: E2E

### TC-305: Search with no matches
**Category**: Negative
**Priority**: P2
**Preconditions**: Logged in
**Steps**:
1. Search `zzzz-no-such-event`
**Expected Results**: "No events found" empty state with the "Try adjusting your filters…" text; no pagination
**Business Rule**: Flow 2
**Suggested Layer**: E2E

### TC-306: Booking form — empty submit
**Category**: Negative
**Priority**: P0
**Preconditions**: Event detail page open
**Steps**:
1. Click Confirm Booking with all fields empty
**Expected Results**: Inline errors "Name must be at least 2 chars", "Enter a valid email", "Enter a valid 10-digit phone"; no POST is sent
**Business Rule**: Booking model constraints; client `validate()`
**Suggested Layer**: E2E

### TC-307: Booking form — name of 1 character
**Category**: Negative
**Priority**: P1
**Preconditions**: Event detail page open
**Steps**:
1. Name `A`, valid email and phone; submit
**Expected Results**: "Name must be at least 2 chars"; no POST
**Business Rule**: customerName min 2
**Suggested Layer**: Component / E2E

### TC-308: Booking form — invalid email formats
**Category**: Negative
**Priority**: P1
**Preconditions**: Event detail page open
**Steps**:
1. Try `john`, `john@`, `john@mail`, `john @mail.com`
**Expected Results**: "Enter a valid email" for each; no POST
**Business Rule**: customerEmail valid format
**Suggested Layer**: Component

### TC-309: Booking form — phone with fewer than 10 digits
**Category**: Negative
**Priority**: P1
**Preconditions**: Event detail page open
**Steps**:
1. Phone `98765 4321` (9 digits)
**Expected Results**: "Enter a valid 10-digit phone"; no POST
**Business Rule**: customerPhone min 10 digits
**Suggested Layer**: Component

### TC-310: API — create booking with missing fields
**Category**: Negative
**Priority**: P0
**Preconditions**: Valid token
**Steps**:
1. `POST /api/bookings` with `{}`, then omitting each required field in turn
**Expected Results**: 400 `{ error: "Validation failed", details: [...] }` naming each missing field ("Event ID is required", "Customer name is required", …); nothing is created and nothing is pruned
**Business Rule**: `validateCreateBooking`
**Suggested Layer**: API

### TC-311: API — quantity outside 1–10 or not an integer
**Category**: Negative
**Priority**: P0
**Preconditions**: Valid token
**Steps**:
1. Send quantity `0`, `-1`, `11`, `2.5`, `"abc"`
**Expected Results**: 400 "Quantity must be an integer between 1 and 10"
**Business Rule**: quantity 1–10
**Suggested Layer**: API

### TC-312: API — phone with letters, or too short
**Category**: Negative
**Priority**: P1
**Preconditions**: Valid token
**Steps**:
1. Phone `98765abcde`, then `12345`
**Expected Results**: 400 "Customer phone must contain only digits and +, -, spaces, or parentheses" / "…at least 10 digits"
**Business Rule**: customerPhone validator
**Suggested Layer**: API

### TC-313: API — invalid eventId values
**Category**: Negative
**Priority**: P1
**Preconditions**: Valid token
**Steps**:
1. eventId `0`, `-5`, `1.5`, `"abc"`
**Expected Results**: 400 "Event ID must be a positive integer"
**Business Rule**: eventId validator
**Suggested Layer**: API

### TC-314: Book a non-existent event
**Category**: Negative
**Priority**: P1
**Preconditions**: Valid token; user has < 9 bookings
**Steps**:
1. `POST /api/bookings` with `eventId: 999999`
**Expected Results**: 404 "Event with id 999999 not found"; booking count unchanged
**Business Rule**: Event must exist
**Suggested Layer**: API

### TC-315: Request more seats than available
**Category**: Negative
**Priority**: P0
**Preconditions**: Own dynamic event with totalSeats = 3
**Steps**:
1. `POST /api/bookings` with quantity 4
**Expected Results**: 400 "Only 3 seat(s) available, but 4 requested"; no booking created
**Business Rule**: API error — Insufficient seats → 400
**Suggested Layer**: API

### TC-316: Book a sold-out event via API
**Category**: Negative
**Priority**: P1
**Preconditions**: Own event with totalSeats = 2, already booked 2
**Steps**:
1. `POST /api/bookings` quantity 1
**Expected Results**: 400 "Only 0 seat(s) available, but 1 requested"
**Business Rule**: Seat availability
**Suggested Layer**: API

### TC-317: API error message is shown as a toast on the booking form
**Category**: Negative
**Priority**: P1
**Preconditions**: Event detail page open
**Steps**:
1. Use `page.route` to make `POST /api/bookings` return 400 `{ error: "Only 0 seat(s) available, but 1 requested" }`
2. Submit a valid form
**Expected Results**: Error toast shows the server's `error` text; the form stays filled; no confirmation card
**Business Rule**: axios interceptor maps `response.data.error` to the message
**Suggested Layer**: E2E (mocked)

### TC-318: Event detail for a non-existent or other user's event
**Category**: Negative
**Priority**: P1
**Preconditions**: Logged in
**Steps**:
1. Navigate to `/events/999999`, then to another user's dynamic event ID
**Expected Results**: "Event not found" empty state with a "Browse Events" button; no booking form
**Business Rule**: §2; event detail error state
**Suggested Layer**: E2E

### TC-319: Booking detail for a non-existent ID
**Category**: Negative
**Priority**: P1
**Preconditions**: Logged in
**Steps**:
1. Navigate to `/bookings/999999`; call `GET /api/bookings/999999`
**Expected Results**: UI "Booking not found" with "View My Bookings"; API 404
**Business Rule**: NotFoundError
**Suggested Layer**: E2E + API

### TC-320: Booking detail with a non-numeric ID
**Category**: Negative
**Priority**: P2
**Preconditions**: Logged in
**Steps**:
1. `GET /api/bookings/abc` and `DELETE /api/bookings/abc`; navigate to `/bookings/abc`
**Expected Results**: Expected 400 or 404. ⚠ Discrepancy A-8: `Number('abc')` is `NaN` and goes to Prisma, so the API likely returns **500**. UI should still show "Booking not found"
**Business Rule**: Input validation (no validator on `:id`)
**Suggested Layer**: API

### TC-321: Cancel an already cancelled booking
**Category**: Negative
**Priority**: P1
**Preconditions**: Booking X deleted
**Steps**:
1. `DELETE /api/bookings/X` again
**Expected Results**: 404 "Booking with id X not found"
**Business Rule**: Cancel is a hard delete
**Suggested Layer**: API

### TC-322: Cancel fails while the dialog is open (stale tab)
**Category**: Negative
**Priority**: P2
**Preconditions**: Booking detail open in two tabs
**Steps**:
1. Cancel in tab 1
2. In tab 2, click "Cancel Booking" → "Yes, cancel it"
**Expected Results**: Error toast "Booking with id X not found"; dialog closes; no crash
**Business Rule**: `handleCancel` onError
**Suggested Layer**: E2E

### TC-323: Bookings list server error with retry
**Category**: Negative
**Priority**: P2
**Preconditions**: Logged in
**Steps**:
1. Mock `GET /api/bookings` to return 500, open `/bookings`
2. Remove the mock and click "Retry"
**Expected Results**: "Couldn't load bookings" / "Failed to connect to the server." with Retry; after Retry the list loads
**Business Rule**: Bookings page error state
**Suggested Layer**: E2E (mocked)

### TC-324: Create an event with a past date
**Category**: Negative
**Priority**: P1
**Preconditions**: —
**Steps**:
1. `POST /api/events` with yesterday's `eventDate`; also try via the admin form
**Expected Results**: 400 "Event date must be in the future"; UI shows an error toast; no event created
**Business Rule**: eventDate must be future
**Suggested Layer**: API + E2E

### TC-325: Create an event with invalid price or seats
**Category**: Negative
**Priority**: P1
**Preconditions**: —
**Steps**:
1. price `-1`, `"abc"`; totalSeats `0`, `-3`, `1.5`
**Expected Results**: 400 "Price must be a non-negative number" / "Total seats must be a positive integer"
**Business Rule**: price ≥ 0, totalSeats ≥ 1
**Suggested Layer**: API

### TC-326: Admin event form required fields
**Category**: Negative
**Priority**: P2
**Preconditions**: `/admin/events` open
**Steps**:
1. Click `#add-event-btn` with an empty form
**Expected Results**: Inline errors for Title, Category, Venue, City, Event Date; no POST
**Business Rule**: `EventForm.validate`
**Suggested Layer**: Component / E2E

---

## Edge Cases (TC-400 – TC-499)

### TC-400: Email case on register and login
**Category**: Edge Case
**Priority**: P2
**Preconditions**: `qa.case@test.com` registered
**Steps**:
1. Register `QA.Case@Test.com`
2. Log in with `QA.CASE@TEST.COM`
**Expected Results**: Document the behaviour. Emails are not normalised before lookup, so the result depends on the MySQL collation (default case-insensitive: register → "Email already registered", login succeeds). Product should confirm this is intended
**Business Rule**: User.email unique
**Suggested Layer**: API

### TC-401: Events pagination at 12 per page
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Static + dynamic events total > 12 (or mock the list)
**Steps**:
1. Open `/events`, go to page 2
**Expected Results**: Page 1 has 12 cards; page 2 has the rest; changing a filter resets to page 1. ⚠ Discrepancy A-10: the UI uses 12 per page, business-rules says 9
**Business Rule**: Flow 2 — 12 per page
**Suggested Layer**: E2E (mocked) / API

### TC-402: Event list query parameter boundaries
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Valid token
**Steps**:
1. `GET /api/events?page=0`, `?page=-1`, `?limit=0`, `?limit=100000`, `?page=999`
**Expected Results**: `page=0`/`limit=0` fall back to defaults (1/10); `page=999` → empty `data` and correct `totalPages`; `page=-1` should be rejected or defaulted (likely **500** from a negative `skip`; see A-8); a huge `limit` has no cap
**Business Rule**: Pagination
**Suggested Layer**: API

### TC-403: City filter option not in the domain list
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Logged in
**Steps**:
1. Pick "Pune" in the city filter
**Expected Results**: Empty state (no events), no error. ⚠ Discrepancy A-11: the UI offers Pune, and the backend accepts any city/category string on create
**Business Rule**: Event.city ∈ {Bangalore, Mumbai, Hyderabad, Delhi, Chennai}
**Suggested Layer**: E2E / API

### TC-404: Quantity minimum boundary (1)
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Booking form open
**Steps**:
1. Observe the "−" button at quantity 1; click it
**Expected Results**: "−" is disabled; `#ticket-count` stays 1
**Business Rule**: Quantity 1–10
**Suggested Layer**: Component / E2E

### TC-405: Quantity maximum boundary (10)
**Category**: Edge Case
**Priority**: P0
**Preconditions**: Event with ≥ 10 available seats
**Steps**:
1. Click "+" 12 times
2. Confirm booking
**Expected Results**: Count stops at 10; "+" disabled; label "(max 10)"; booking succeeds with qty 10 and total = price × 10
**Business Rule**: Quantity max 10
**Suggested Layer**: E2E

### TC-406: Quantity capped by available seats below 10
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Own event with totalSeats = 3
**Steps**:
1. Open the booking form; click "+" 5 times
**Expected Results**: Label "(max 3)"; count stops at 3; "+" disabled
**Business Rule**: `maxQty = min(10, availableSeats)`
**Suggested Layer**: E2E

### TC-407: Book exactly the last available seats
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Own event, totalSeats = 5
**Steps**:
1. Book 5 tickets
2. Revisit the event card and detail page
**Expected Results**: Booking succeeds; card shows "SOLD OUT" overlay and a disabled "Sold Out" link; detail shows "SOLD OUT" and a disabled "Sold Out" button
**Business Rule**: Seat availability boundary
**Suggested Layer**: E2E

### TC-408: Low-seat indicator threshold (≤ 10)
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Own events with 11, 10 and 1 available seats
**Steps**:
1. View `/events`
**Expected Results**: 11 → "11 seats available" (green); 10 → "10 seats left!" (amber); 1 → "1 seat left!" (singular)
**Business Rule**: `SeatsIndicator`
**Suggested Layer**: Component

### TC-409: Customer name boundaries and trimming
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Booking form open
**Steps**:
1. Name `Al` (exactly 2) → submit
2. Name `" A"` (space + one letter) → submit
**Expected Results**: `Al` succeeds. `" A"` passes the client check (untrimmed length 2) but the API trims it to "A" and returns 400. ⚠ A-12: client and server rules differ; check the user sees a clear message
**Business Rule**: customerName min 2
**Suggested Layer**: API + Component

### TC-410: Phone formats accepted by client vs server
**Category**: Edge Case
**Priority**: P2
**Preconditions**: —
**Steps**:
1. `+91 98765 43210`, `(987) 654-3210`, `9876543210` → submit via UI
2. `abc9876543210` via UI
3. `+1 (23) 4-5` (10 chars, 5 digits) via API
**Expected Results**: Step 1 all succeed. Step 2 passes the client (10 digits) but the API rejects letters → error toast. Step 3 is accepted by the API (it counts characters, not digits). ⚠ A-12
**Business Rule**: customerPhone min 10 digits
**Suggested Layer**: API + Component

### TC-411: Customer email normalisation
**Category**: Edge Case
**Priority**: P3
**Preconditions**: —
**Steps**:
1. Book with customer email `John.Doe+tickets@GMail.com`
**Expected Results**: Document the stored value. `normalizeEmail()` lowercases it and, for Gmail, strips dots and the `+` suffix (`johndoe@gmail.com`), so the detail page shows a different address from the one entered. Product should confirm
**Business Rule**: customerEmail valid format
**Suggested Layer**: API

### TC-412: Booking ref for titles starting with a digit or symbol
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Own events titled `2026 Expo`, `#Hackathon`, `éclair fest`, `🎉 Party`
**Steps**:
1. Book each
**Expected Results**: Prefixes `2-`, `#-`, `É-`. For the emoji title the prefix is half of a surrogate pair (invalid character) → record as a defect if the ref is malformed. Leading spaces are trimmed by the validator, so `"  zen"` → `Z-`
**Business Rule**: §7
**Suggested Layer**: API / Unit (`randomRef`)

### TC-413: Booking a past event
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Seeded static event with a past date (e.g. "World Tech Summit", 2026-04-18)
**Steps**:
1. Book it via the UI and the API
**Expected Results**: ⚠ Discrepancy A-7: currently succeeds (no date check on booking). Expected per domain intent ("upcoming events"): past events should be hidden or unbookable. Needs a product decision
**Business Rule**: Event.eventDate must be future
**Suggested Layer**: API

### TC-414: Decimal prices and display rounding
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Own event with price 99.50
**Steps**:
1. Book 3 tickets
**Expected Results**: API `totalPrice` = 298.5. UI shows `$100 × 3` and `$299` (formatter uses `maximumFractionDigits: 0`). Confirm with product whether the rounded display is acceptable
**Business Rule**: §9
**Suggested Layer**: API + Component

### TC-415: Free event (price 0)
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Own event with price 0
**Steps**:
1. Book 2 tickets
**Expected Results**: Booking succeeds; total $0 everywhere
**Business Rule**: price ≥ 0
**Suggested Layer**: API

### TC-416: Double-click on Confirm Booking
**Category**: Edge Case
**Priority**: P1
**Preconditions**: Booking form filled
**Steps**:
1. Double-click Confirm Booking quickly
**Expected Results**: Exactly one booking is created (button shows a loading state while `isPending`); count in `/bookings` increases by 1
**Business Rule**: One booking per confirmation
**Suggested Layer**: E2E

### TC-417: Booking limit exactly at 9
**Category**: Edge Case
**Priority**: P0
**Preconditions**: Bookings cleared
**Steps**:
1. Create 9 bookings
**Expected Results**: All 9 exist; nothing pruned (pruning starts at the 10th)
**Business Rule**: §4 — max 9
**Suggested Layer**: API

### TC-418: Failed 10th booking still prunes the oldest
**Category**: Edge Case
**Priority**: P0
**Preconditions**: User has exactly 9 bookings
**Steps**:
1. `POST /api/bookings` for `eventId: 999999` (404) or with quantity over the available seats (400)
2. `GET /api/bookings`
**Expected Results**: Expected: 9 bookings, nothing lost. ⚠ Discrepancy A-4: the code prunes **before** checking the event and seats, so the user ends up with 8 bookings after a failed request. Likely defect
**Business Rule**: §4 — FIFO only on a successful new booking
**Suggested Layer**: API

### TC-419: Concurrent bookings at the limit
**Category**: Edge Case
**Priority**: P3
**Preconditions**: User has 8 bookings
**Steps**:
1. Fire 3 `POST /api/bookings` in parallel
**Expected Results**: Final count ≤ 9. Without a transaction, count/prune/create can interleave and leave 10+. Record it
**Business Rule**: §4
**Suggested Layer**: API

### TC-420: Concurrent bookings for the last seats
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Own event with totalSeats = 2
**Steps**:
1. Fire two parallel bookings of quantity 2
**Expected Results**: Exactly one succeeds; the other returns 400. Any oversell is a defect (no locking)
**Business Rule**: Seat availability
**Suggested Layer**: API

### TC-421: Bookings list with exactly 9 bookings
**Category**: Edge Case
**Priority**: P2
**Preconditions**: 9 bookings
**Steps**:
1. Open `/bookings`
**Expected Results**: All 9 cards on one page; pagination shows 1 page. Note: the page requests `limit: 10`, and with the 9 cap page 2 can't happen in normal use (A-10)
**Business Rule**: §4 — bookings page shows max 9
**Suggested Layer**: E2E

### TC-422: Leaving during the refund spinner
**Category**: Edge Case
**Priority**: P3
**Preconditions**: Booking detail open
**Steps**:
1. Click `#check-refund-btn`, then within 4s click "← Back to My Bookings"
**Expected Results**: No crash or React warning about updating an unmounted component; returning shows the idle "Check eligibility…" link again
**Business Rule**: §8
**Suggested Layer**: E2E

### TC-423: Reducing an event's total seats below what was booked
**Category**: Edge Case
**Priority**: P2
**Preconditions**: Own event totalSeats = 10; booked 6
**Steps**:
1. `PUT /api/events/:id` with totalSeats 4 (full valid body)
2. `GET /api/events/:id`; try to book 1
**Expected Results**: Document it. `updateEvent` changes `totalSeats` but not the stored `availableSeats` (still 10), so the user sees 4 available out of 4 total and can keep booking. ⚠ A-9: likely defect
**Business Rule**: §6
**Suggested Layer**: API

### TC-424: Event date exactly now or a few seconds ahead
**Category**: Edge Case
**Priority**: P3
**Preconditions**: —
**Steps**:
1. `POST /api/events` with `eventDate` = now + 2s, then now − 1s
**Expected Results**: +2s accepted; −1s rejected with "Event date must be in the future"
**Business Rule**: eventDate must be future
**Suggested Layer**: API

---

## UI State (TC-500 – TC-599)

### TC-500: Auth pages while a token is being checked
**Category**: UI State
**Priority**: P3
**Preconditions**: Valid token stored
**Steps**:
1. Hard-reload `/bookings` with `/api/auth/me` slowed down by a mock
**Expected Results**: Full-screen spinner while checking; no flash of the login page or bookings content
**Business Rule**: `AuthGuard` isLoading
**Suggested Layer**: E2E (mocked)

### TC-501: Events list skeleton while loading
**Category**: UI State
**Priority**: P3
**Preconditions**: Logged in
**Steps**:
1. Delay `GET /api/events` with `page.route`; open `/events`
**Expected Results**: 12 skeleton cards are shown, then replaced by event cards
**Business Rule**: Events page loading state
**Suggested Layer**: E2E (mocked)

### TC-502: Events list error state with retry
**Category**: UI State
**Priority**: P2
**Preconditions**: Logged in
**Steps**:
1. Mock `GET /api/events` → 500; open `/events`; then remove the mock and click Retry
**Expected Results**: "Couldn't load events" with Retry; Retry loads the list
**Business Rule**: Events page error state
**Suggested Layer**: E2E (mocked)

### TC-503: Sandbox banner on the events page
**Category**: UI State
**Priority**: P1
**Preconditions**: Logged in
**Steps**:
1. Mock `GET /api/events` with 5 events → open `/events`
2. Mock with 6 events → reload
**Expected Results**: 5 → no banner. 6 → banner "Your sandbox holds up to 9 bookings and you can create up to 6 custom events…" (`getByText(/sandbox holds up to/i)`)
**Business Rule**: §5 — banner shown when > 5 events on the page, hidden below
**Suggested Layer**: E2E (mocked)

### TC-504: "Clear filters" button visibility
**Category**: UI State
**Priority**: P3
**Preconditions**: `/events` open
**Steps**:
1. No filters → check; type a search → check; clear → check
**Expected Results**: The button appears only while a search, category or city is set
**Business Rule**: `EventFilters.hasFilters`
**Suggested Layer**: Component

### TC-505: Event detail loading spinner
**Category**: UI State
**Priority**: P3
**Preconditions**: —
**Steps**:
1. Delay `GET /api/events/:id`; open `/events/:id`
**Expected Results**: Centered spinner, then details and booking panel
**Business Rule**: Event detail loading state
**Suggested Layer**: E2E (mocked)

### TC-506: Featured badge and info box only for static events
**Category**: UI State
**Priority**: P2
**Preconditions**: One static and one own dynamic event
**Steps**:
1. Open both detail pages and look at both cards
**Expected Results**: Static: "Featured" badge on card and detail, plus "This is a featured event — always available for practice". Dynamic: neither
**Business Rule**: isStatic display
**Suggested Layer**: E2E

### TC-507: Price summary updates live with quantity
**Category**: UI State
**Priority**: P1
**Preconditions**: Booking form open (price P)
**Steps**:
1. Step quantity 1 → 2 → 3
**Expected Results**: Line text "$P × 1 ticket" (singular) → "× 2 tickets" (plural); Total updates each time
**Business Rule**: §9
**Suggested Layer**: Component

### TC-508: Inline errors clear after a valid resubmit
**Category**: UI State
**Priority**: P2
**Preconditions**: TC-306 error state shown
**Steps**:
1. Fix all fields and submit
**Expected Results**: All inline errors disappear and the confirmation card appears
**Business Rule**: `setErrors({})` on valid submit
**Suggested Layer**: E2E

### TC-509: Confirm button loading state
**Category**: UI State
**Priority**: P2
**Preconditions**: Booking form filled
**Steps**:
1. Delay `POST /api/bookings`; submit
**Expected Results**: Button shows loading and can't be clicked again until the response arrives
**Business Rule**: `loading={isPending}`
**Suggested Layer**: E2E (mocked)

### TC-510: Sold-out event detail
**Category**: UI State
**Priority**: P1
**Preconditions**: Event with 0 available seats for this user (or mocked)
**Steps**:
1. Open `/events/:id`
**Expected Results**: "Available" shows "SOLD OUT" in red; button reads "Sold Out" and is disabled; label "(max 0)". ⚠ the "+" and "−" buttons are both disabled at quantity 1 with max 0; confirm this is acceptable
**Business Rule**: Seat availability
**Suggested Layer**: E2E (mocked)

### TC-511: Seat count on event detail after booking and returning
**Category**: UI State
**Priority**: P2
**Preconditions**: Dynamic event with 20 seats
**Steps**:
1. Book 2 on `/events/:id`, click "Browse More Events", then open the same event again (no reload)
**Expected Results**: Detail shows 18 / 20. ⚠ `useCreateBooking` invalidates `['events']` but not `['event', id]`, so a stale "20 / 20" may show until refetch. Record if seen
**Business Rule**: §6 — seat count reduces immediately
**Suggested Layer**: E2E

### TC-512: Confirmation card replaces the form
**Category**: UI State
**Priority**: P2
**Preconditions**: Booking just confirmed
**Steps**:
1. Inspect the booking panel
**Expected Results**: The form is gone; confirmation card with ref, customer, tickets, total and two navigation buttons. Reloading the page shows a fresh empty form
**Business Rule**: Flow 3 step 6
**Suggested Layer**: E2E

### TC-513: Bookings list skeleton while loading
**Category**: UI State
**Priority**: P3
**Preconditions**: —
**Steps**:
1. Delay `GET /api/bookings`; open `/bookings`
**Expected Results**: 5 skeleton cards, then real cards
**Business Rule**: Bookings page loading state
**Suggested Layer**: E2E (mocked)

### TC-514: Bookings empty state
**Category**: UI State
**Priority**: P1
**Preconditions**: User has 0 bookings
**Steps**:
1. Open `/bookings`; click "Browse Events"
**Expected Results**: "No bookings yet" with the descriptive text; button goes to `/events`
**Business Rule**: Flow 4
**Suggested Layer**: E2E

### TC-515: "Clear all bookings" visible with zero bookings
**Category**: UI State
**Priority**: P3
**Preconditions**: 0 bookings
**Steps**:
1. Open `/bookings`
**Expected Results**: ⚠ Discrepancy A-13: the link is always rendered (ui-selectors says it appears only when bookings exist). Clicking it and confirming returns "0 booking(s) cleared" without error. Decide which is intended
**Business Rule**: ui-selectors — Clear all visible when bookings exist
**Suggested Layer**: E2E

### TC-516: Dismissing the Clear-all confirm keeps bookings
**Category**: UI State
**Priority**: P1
**Preconditions**: ≥ 1 booking
**Steps**:
1. Click "Clear all bookings"; dismiss the native dialog (`page.once('dialog', d => d.dismiss())`)
**Expected Results**: No DELETE request; all bookings remain
**Business Rule**: Clear all requires confirmation
**Suggested Layer**: E2E

### TC-517: "Clearing…" state and failure handling
**Category**: UI State
**Priority**: P2
**Preconditions**: ≥ 1 booking
**Steps**:
1. Delay `DELETE /api/bookings` → accept the dialog → observe
2. Mock it to return 500 → accept
**Expected Results**: Step 1: link reads "Clearing…" and is disabled, then returns to normal. Step 2: the button re-enables; note there is **no error toast** (try/finally with no catch → unhandled rejection), so the user gets no feedback. Record as a UX defect
**Business Rule**: Bookings page `handleClearAll`
**Suggested Layer**: E2E (mocked)

### TC-518: Cancel dialog content and dismissal
**Category**: UI State
**Priority**: P1
**Preconditions**: Booking with qty 3
**Steps**:
1. Click "Cancel Booking"; read the dialog; close it without confirming
**Expected Results**: Title "Cancel this booking?"; text mentions the ref and "release 3 seat(s)"; after closing, no DELETE request is sent and the booking remains
**Business Rule**: Flow 4 — cancel needs confirmation
**Suggested Layer**: E2E

### TC-519: Ticket wording on booking cards
**Category**: UI State
**Priority**: P3
**Preconditions**: Bookings with qty 1 and qty 2
**Steps**:
1. View `/bookings`
**Expected Results**: "🎫 1 ticket" and "🎫 2 tickets"
**Business Rule**: BookingCard pluralisation
**Suggested Layer**: Component

### TC-520: Booking detail loading and Access Denied states
**Category**: UI State
**Priority**: P2
**Preconditions**: —
**Steps**:
1. Delay `GET /api/bookings/:id` → observe the spinner
2. Mock a 403 → observe; mock a 404 → observe
**Expected Results**: Spinner while loading; 403 → "Access Denied" / "You are not authorized to view this booking."; 404 → "Booking not found" / "This booking doesn't exist or may have been cancelled."; both have "View My Bookings"
**Business Rule**: Booking detail error branch (`error.status === 403`)
**Suggested Layer**: E2E (mocked)

### TC-521: Breadcrumb and back navigation on booking detail
**Category**: UI State
**Priority**: P3
**Preconditions**: Booking detail open
**Steps**:
1. Click the "My Bookings" breadcrumb; return; click "← Back to My Bookings"
**Expected Results**: Both go to `/bookings`; breadcrumb shows the ref in monospace
**Business Rule**: Flow 4
**Suggested Layer**: E2E

### TC-522: Bookings list refreshes after a cancel
**Category**: UI State
**Priority**: P2
**Preconditions**: 2 bookings on a dynamic event
**Steps**:
1. Cancel one from the list; open `/events`
**Expected Results**: List shows 1 booking without a reload; event card seat count is updated (both `['bookings']` and `['events']` are invalidated)
**Business Rule**: §4 — seats freed immediately
**Suggested Layer**: E2E

### TC-523: Refund spinner timing
**Category**: UI State
**Priority**: P2
**Preconditions**: Booking detail open
**Steps**:
1. Click `#check-refund-btn`
**Expected Results**: The button disappears immediately; `#refund-spinner` with "Checking your refund eligibility…" shows for ~4s; then `#refund-result` replaces it. Use `expect(...).toBeVisible({ timeout: 6000 })`, not a fixed wait. Prefer `page.clock` to make it deterministic
**Business Rule**: §8 — 4-second spinner
**Suggested Layer**: E2E / Component

### TC-524: Refund result persists until reload
**Category**: UI State
**Priority**: P3
**Preconditions**: Refund result shown
**Steps**:
1. Look for the check button; reload the page
**Expected Results**: No check button while the result shows; after reload the idle "Check eligibility for refund?" link is back
**Business Rule**: §8 — client-side state only
**Suggested Layer**: E2E

### TC-525: Admin events page shows static events read-only
**Category**: UI State
**Priority**: P2
**Preconditions**: Own events and static events listed
**Steps**:
1. Open `/admin/events`
**Expected Results**: The "up to 6 events" note is shown; static rows have no Edit/Delete buttons; own rows have Edit and `#delete-event-btn`
**Business Rule**: §3
**Suggested Layer**: E2E

---

## Appendix A — Code vs Domain Discrepancies

Found while reading the code. Each one needs a product decision before the related test is automated with a hard assertion.

| # | Area | Domain skill says | Code does | Where | Scenarios |
|---|---|---|---|---|---|
| A-1 | Register duplicate | 409 "Email already registered" | 400 (`ValidationError`) | `authService.register` | TC-300 |
| A-2 | Login failure | 401 "Invalid credentials" | 400 "Invalid email or password" | `authService.login` | TC-301 |
| A-3 | Cancel another user's booking | 403 Forbidden | 404 (lookup is scoped by userId, so the 403 branch can't run) | `bookingService.cancelBooking` | TC-212 |
| A-4 | FIFO booking prune | Oldest is replaced when a new booking is added | Prune runs **before** the event and seat checks, so a failed 10th booking still deletes one | `bookingService.createBooking` | TC-207, TC-418 |
| A-5 | Same-event FIFO fallback | Seats restore on cancel | Permanently decrements `availableSeats` on the event row (static events too), and nothing restores it | `bookingService.createBooking` | TC-111 |
| A-6 | Seed data | 10 static events (Tech Conference Bangalore, …) | 3 static events: World Tech Summit, Hollywood Monsoon Night — Los Angeles, Dilli Diwali Mela | `prisma/seed.js` | TC-100, TC-103 |
| A-7 | Past events | eventDate must be in the future | Only checked on create/update; 2 of the 3 seeded events (2026-04-18, 2026-07-11) are already past and still bookable | `bookingService`, seed | TC-413 |
| A-8 | Non-numeric/negative IDs and pages | — | `Number('abc')` → NaN and negative `skip` reach Prisma; probably 500 | repositories | TC-320, TC-402 |
| A-9 | Event update | — | Changing `totalSeats` doesn't change stored `availableSeats` | `eventService.updateEvent` | TC-423 |
| A-10 | Page sizes | Events page max 9; bookings page max 9 | Events page 12; bookings page requests 10 | `events/page.tsx`, `bookings/page.tsx` | TC-401, TC-421 |
| A-11 | Cities/categories | Fixed lists | UI city filter includes "Pune"; API accepts any string | `EventFilters.jsx`, `eventValidator` | TC-403 |
| A-12 | Customer field rules | name ≥ 2, phone ≥ 10 digits | Client checks untrimmed name length and digit count; server trims name and counts characters while rejecting letters | `events/[id]/page.tsx`, `bookingValidator` | TC-409, TC-410 |
| A-13 | Clear-all link | Visible when bookings exist | Always visible | `bookings/page.tsx` | TC-515 |
| A-14 | Booking status | Always "confirmed" | Swagger and admin filter offer "cancelled", but cancel hard-deletes, so it never appears | `bookingRoutes`, `admin/bookings` | TC-115 |
