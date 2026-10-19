# TicketHub — System Design Document

## 1. Requirements

TicketHub is an online ticketing platform where users discover events, view available seats, reserve seats, pay for tickets, and view their purchases.

### 1.1 Functional requirements

1. Users can register, log in, and securely manage their accounts.
2. Users can browse, search, and view event details.
3. Users can view a concert's seating plan and current seat availability.
4. Users can temporarily hold available seats while completing checkout.
5. Users can pay for an order and receive confirmation when payment succeeds.
6. Users can view their purchased tickets and booking history.
7. The system releases expired seat holds and makes unpaid seats available again.
8. Administrators can create events, configure seating, and monitor sales.

### 1.2 Non-functional requirements

- **Performance:** Cached event pages should load within 300 ms under normal conditions; dynamic requests should target a p95 response time below 500 ms, excluding external payment processing.
- **Correctness:** A seat must never be sold to two different customers.
- **Fairness:** A waiting room should distribute access to the checkout process in a controlled, observable order and prevent automated clients from overwhelming the service.
- **Availability:** Browsing should remain available during individual application-server failures.
- **Scalability:** The system should handle normal traffic and sudden increases during popular concert sales.
- **Security:** Authentication, authorization, encrypted connections, rate limits, and secure payment-provider integration are required.
- **Reliability:** Orders and payment events must be handled idempotently so retries do not create duplicate purchases.
- **Consistency:** Seat availability and booking decisions must use authoritative database state rather than trusting a cache.

## 2. Traffic and Storage Estimates

### 2.1 Assumptions

- 2,000,000 registered users.
- On a normal day, 50,000 people visit the website.
- Each daily visitor views 10 pages.
- 5,000 tickets are sold on a normal day.
- During a popular concert sale, 200,000 people attempt to purchase tickets for 20,000 seats within 10 minutes.
- One day contains 86,400 seconds.
- For peak estimates, the normal traffic baseline is not added separately to the sale traffic.
- For planning purposes, each person attempting a purchase generates approximately five API requests during the sale journey; actual request counts will be measured.
- Storage estimates for ticketing records exclude logs, backups, analytics, and payment-provider records because the sizes and retention policies are not specified.

### 2.2 Normal traffic

**Page views per day**

50,000 visitors × 10 pages = 500,000 page views/day.

**Average page views per second**

500,000 ÷ 86,400 = approximately **5.79 page views/second**.

This is a baseline estimate, not the total API request rate: a single page may generate several API requests and static asset requests.

**Ticket sales**

5,000 ÷ 86,400 = approximately **0.058 tickets/second**, or about 208 tickets/hour on average.

### 2.3 Popular concert sale

**Purchase attempts per second**

200,000 ÷ (10 × 60) = approximately **333 purchase attempts/second**.

**Estimated API requests per second**

Assuming five API requests per purchasing visitor:

200,000 × 5 ÷ 600 = approximately **1,667 API requests/second**.

This is a planning estimate. Browsing, retries, polling, bots, and clients who abandon checkout could change the actual rate.

**Maximum successful seat sales per second**

20,000 ÷ 600 = approximately **33.3 tickets/second**, averaged over the 10-minute window if every seat sells within that period.

**Demand versus supply**

200,000 people compete for 20,000 seats, giving **10 potential buyers per seat**. Therefore, 180,000 people cannot obtain a seat for this concert if demand reaches the stated level.

### 2.4 Comparison

| Metric | Normal day | Popular sale |
|---|---:|---:|
| Visitors or purchase attempts | 50,000/day | 200,000 in 10 minutes |
| Page views / assumed API requests | 5.79 page views/sec on average | 1,667 API requests/sec estimated |
| Ticket sales | 5,000/day | Up to 20,000 in 10 minutes |
| Main challenge | Efficient everyday browsing | Sudden concurrency and seat contention |

The sale's estimated API request rate is approximately 288 times the normal average page-view rate. These figures measure different request types, so this ratio is a rough capacity comparison rather than an exact like-for-like multiplier.

### 2.5 Storage

The provided facts do not specify how large event, user, order, and ticket records are, so a defensible total storage estimate requires a measured record size.

For a simple planning example, assume each completed ticket sale adds 2 KB of application database records, including its order and ticket metadata, before indexes and replication.

- Normal ticket records per year: 5,000 × 365 = 1,825,000.
- Approximate new ticket-record storage: 1,825,000 × 2 KB = **3.65 GB/year**, using decimal units.
- This estimate excludes users, events, seat inventory, indexes, backups, logs, and replicas.
- A 20,000-seat concert can create at most 20,000 successful ticket sales for that event, even if 200,000 people attempt to buy.

Capacity planning should use observed database row sizes and expected event volumes rather than treating this example as a final production forecast.

## 3. API Design

The production API uses HTTPS and JSON. Authenticated endpoints require a valid session or access token. Seat-hold and order-creation operations accept idempotency keys so clients can retry safely.

| Method | Endpoint | Purpose | Success status |
|---|---|---|---|
| GET | `/api/events` | Browse and search published events, with pagination | 200 OK |
| GET | `/api/events/{event_id}` | Retrieve event details | 200 OK |
| GET | `/api/events/{event_id}/seats` | View seat labels and availability | 200 OK |
| POST | `/api/events/{event_id}/holds` | Request a temporary hold on selected seats | 201 Created |
| POST | `/api/orders` | Create an order for seats currently held by the user | 201 Created |
| POST | `/api/orders/{order_id}/payment` | Initiate or confirm payment through a payment provider | 200 OK |
| GET | `/api/me/tickets` | List the authenticated user's confirmed tickets | 200 OK |
| GET | `/api/orders/{order_id}` | Retrieve an order belonging to the authenticated user | 200 OK |

### 3.1 Browse events

`GET /api/events?page=1&limit=20`

Example response:

```json
{
  "items": [
    {
      "id": 42,
      "name": "Summer Live",
      "venue": "City Arena",
      "starts_at": "2027-06-20T18:00:00Z"
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1
}
```

### 3.2 View seats

`GET /api/events/42/seats`

Example response:

```json
{
  "event_id": 42,
  "seats": [
    {"id": 801, "label": "A-01", "status": "available"},
    {"id": 802, "label": "A-02", "status": "held"},
    {"id": 803, "label": "A-03", "status": "sold"}
  ]
}
```

Seat availability shown to the browser is informational. The database must verify availability again when a hold is requested.

### 3.3 Hold seats

`POST /api/events/42/holds`

Example request:

```json
{
  "seat_ids": [801, 802],
  "idempotency_key": "hold-9c72f1"
}
```

The API validates that all requested seats belong to the event and are available, then atomically holds them for the authenticated user. If any requested seat cannot be held, the operation must fail without leaving a partial hold.

Example response:

```json
{
  "hold_id": "hold_123",
  "event_id": 42,
  "seat_ids": [801, 802],
  "expires_at": "2027-06-20T17:05:00Z",
  "status": "held"
}
```

The example expiry is illustrative; the production hold duration is a configurable business rule.

### 3.4 Create an order

`POST /api/orders`

Example request:

```json
{
  "hold_id": "hold_123",
  "idempotency_key": "order-7b2f10"
}
```

Example response:

```json
{
  "id": "ord_456",
  "status": "pending_payment",
  "amount": 6000,
  "currency": "KES"
}
```

The backend calculates the price from trusted event and seat records, not from a client-supplied amount.

### 3.5 Initiate payment

`POST /api/orders/ord_456/payment`

Example request:

```json
{
  "payment_method": "provider_checkout",
  "idempotency_key": "pay-4d8a21"
}
```

Example response:

```json
{
  "order_id": "ord_456",
  "status": "pending_payment",
  "checkout_url": "https://payments.example/checkout/session"
}
```

The checkout URL is illustrative. The backend verifies payment using a trusted provider callback or server-to-server verification before marking an order as paid and issuing confirmed tickets.

### 3.6 View tickets

`GET /api/me/tickets`

Example response:

```json
{
  "items": [
    {
      "ticket_id": "tkt_9001",
      "event_id": 42,
      "event_name": "Summer Live",
      "seat_label": "A-01",
      "status": "confirmed"
    }
  ]
}
```

### 3.7 Error responses

| Status | Meaning |
|---|---|
| 400 Bad Request | Invalid input or malformed JSON |
| 401 Unauthorized | User is not authenticated |
| 403 Forbidden | User is not allowed to access the resource |
| 404 Not Found | Event, seat, or order does not exist or is not visible to the user |
| 409 Conflict | Seat is no longer available, or the hold has expired |
| 422 Unprocessable Entity | Request is well-formed but violates a business rule |
| 429 Too Many Requests | Rate limit or waiting-room policy exceeded |
| 500 Internal Server Error | Unexpected server-side failure |
| 502/503 Service Unavailable | A dependency is unavailable or the service is temporarily overloaded |

Example error body:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "One or more selected seats are no longer available.",
    "request_id": "req_81af"
  }
}
```

## 4. Data Model

Use PostgreSQL as the authoritative database because ticketing needs transactions, relational integrity, unique constraints, and predictable concurrency control.

### 4.1 Entities and relationships

- **users:** Stores customer accounts.
- **events:** Stores concerts, venues, dates, and event status.
- **seats:** Represents an individual seat belonging to an event, including its availability state and temporary hold details.
- **orders:** Stores the user's purchase attempt, amount, and payment/booking state.
- **order_items:** Connects orders to individual seats and records the price charged for each seat.

Relationships:

1. One user can have many orders: `users 1 → many orders`.
2. One event has many seats: `events 1 → many seats`.
3. One event can have many orders: `events 1 → many orders`.
4. One order can contain many order items: `orders 1 → many order_items`.
5. Each order item references one seat, and a seat can have historical order-item records only if the database permits it safely; an active-sale constraint prevents multiple active purchases of the same seat.

### 4.2 PostgreSQL schema

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    venue VARCHAR(200) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('draft', 'published', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE seats (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id),
    seat_label VARCHAR(30) NOT NULL,
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'held', 'sold')),
    held_by_user_id BIGINT REFERENCES users(id),
    hold_expires_at TIMESTAMPTZ,
    UNIQUE (event_id, seat_label),
    CHECK (
        (status = 'held'
            AND held_by_user_id IS NOT NULL
            AND hold_expires_at IS NOT NULL)
        OR
        (status <> 'held'
            AND held_by_user_id IS NULL
            AND hold_expires_at IS NULL)
    )
);

CREATE TABLE orders (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'pending_payment', 'paid', 'confirmed',
            'cancelled', 'expired', 'refunded'
        )),
    total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'KES',
    idempotency_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, idempotency_key)
);

CREATE TABLE order_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    seat_id BIGINT NOT NULL REFERENCES seats(id),
    price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one active purchase/order item may reference a seat.
CREATE UNIQUE INDEX uq_active_order_item_per_seat
ON order_items (seat_id)
WHERE EXISTS (
    SELECT 1
    FROM orders
    WHERE orders.id = order_items.order_id
      AND orders.status IN ('pending_payment', 'paid', 'confirmed')
);
```

**Implementation note:** PostgreSQL does not allow a partial-index predicate to query another table, so the final index above is illustrative and must not be used as written. Enforce the invariant with a database-supported design, for example a dedicated current-seat allocation table with `seat_id PRIMARY KEY`, or a unique `current_order_id`/allocation field on each seat, updated in the same transaction as the order. Historical orders can then remain stored without blocking future sales after cancellation.

Additional useful indexes:

```sql
CREATE INDEX idx_events_starts_at
ON events (starts_at);

CREATE INDEX idx_seats_event_status
ON seats (event_id, status);

CREATE INDEX idx_orders_user_created
ON orders (user_id, created_at DESC);

CREATE INDEX idx_order_items_order
ON order_items (order_id);
```

These indexes speed up event discovery, seat-map retrieval, user order history, and retrieval of items belonging to an order.

### 4.3 Example queries

**List published upcoming events**

```sql
SELECT id, name, venue, starts_at
FROM events
WHERE status = 'published'
  AND starts_at > NOW()
ORDER BY starts_at
LIMIT 20;
```

**List available seats for an event**

```sql
SELECT id, seat_label, price_cents
FROM seats
WHERE event_id = 42
  AND (
      status = 'available'
      OR (status = 'held' AND hold_expires_at <= NOW())
  )
ORDER BY seat_label;
```

This query displays potentially available seats; it does not reserve them. The hold operation must perform an atomic state change.

**Show a user's orders and seat labels (JOIN)**

```sql
SELECT
    o.id AS order_id,
    o.status,
    e.name AS event_name,
    s.seat_label,
    oi.price_cents
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN seats s ON s.id = oi.seat_id
JOIN events e ON e.id = s.event_id
WHERE o.user_id = 10
ORDER BY o.created_at DESC;
```

**Count confirmed tickets per event**

```sql
SELECT e.id, e.name, COUNT(oi.id) AS ticket_count
FROM events e
JOIN seats s ON s.event_id = e.id
JOIN order_items oi ON oi.seat_id = s.id
JOIN orders o ON o.id = oi.order_id
WHERE o.status = 'confirmed'
GROUP BY e.id, e.name
ORDER BY ticket_count DESC;
```

### 4.4 Preventing double-booking

The database, not the browser, cache, or waiting room, is the final authority on seat ownership.

When a customer requests a hold, the backend starts a transaction and locks the relevant seat rows (for example, with `SELECT ... FOR UPDATE`). It checks the current state and expiry, then updates each seat only if it is still available or its previous hold has expired. A successful hold records the user and expiry time. If any requested seat cannot be held, the transaction rolls back rather than leaving a partial reservation.

The backend also maintains a unique current-allocation record keyed by `seat_id`, so only one active hold/order can own a seat. Payment confirmation, seat allocation, and order-state changes must be coordinated safely and made idempotent. Expired holds are released by a worker, while every new hold still rechecks the database because cleanup jobs can run late.

### 4.5 Why SQL?

PostgreSQL is a strong fit because users, events, seats, orders, and payments have structured relationships, and the system requires transactions, constraints, and strong consistency for seat ownership. A cache and event queue can improve performance, but neither replaces the database's integrity guarantees.

## 5. Architecture

### 5.1 Architecture diagram

```text
                    Customers / Browsers
                            |
                         DNS/CDN
               (static assets and cached pages)
                            |
                     Waiting Room
               (controls admission during sales)
                            |
                     Load Balancer
                            |
                 +----------+----------+
                 |                     |
             App Server 1          App Server 2
                 |                     |
                 +----------+----------+
                            |
                +-----------+-----------+
                |           |           |
             Redis       Primary DB   Message Queue
             Cache          |              |
                            |           Worker(s)
                       Read Replica    (expire holds,
                            |           reconcile jobs)
                            |
                   Reporting / Reads

App servers also integrate with an external payment provider.
Seat holds and order writes go to the primary database.
```

The CDN may cache public event information and static files, but never treats cached seat availability as authoritative. Seat allocation and payment decisions must reach the application and authoritative database.

### 5.2 Component responsibilities

- **Client/browser:** Lets customers browse events, choose seats, and complete checkout.
- **DNS:** Resolves the TicketHub domain to the appropriate edge service.
- **CDN:** Serves static assets and cacheable public event content close to users.
- **Waiting room:** Controls how many sale participants enter the purchase flow at once and helps reduce overload.
- **Load balancer:** Distributes incoming requests across healthy application servers.
- **Application servers:** Validate users, apply booking rules, and expose the REST API; multiple instances avoid dependence on a single application process.
- **Redis cache:** Speeds up frequently requested public event data and reduces database reads, while seat writes remain authoritative in PostgreSQL.
- **Primary PostgreSQL database:** Owns the authoritative seat state, transactions, orders, and integrity constraints.
- **Read replica:** Handles suitable read-heavy queries, such as reporting and non-critical browsing, reducing load on the primary; replication lag means it must not decide whether a seat can be sold.
- **Message queue:** Buffers asynchronous work so spikes do not overwhelm workers and allows retrying failed background tasks.
- **Workers:** Expire holds, reconcile delayed payment events, and send ticket-confirmation notifications.
- **Payment provider:** Processes payment details without TicketHub storing raw card data and sends verifiable payment results.
- **Monitoring and alerting:** Tracks latency, error rates, database contention, queue depth, and payment failures so operators can respond quickly.

### 5.3 GET /api/events flow

1. The browser resolves the domain through DNS and connects over HTTPS.
2. The CDN serves cached static assets and eligible public event responses when possible.
3. Dynamic requests pass through the load balancer to a healthy application server.
4. The server validates query parameters and checks Redis for cached event data.
5. On a cache miss, the server queries PostgreSQL or an appropriate read replica, depending on the consistency requirement.
6. The server caches eligible results with a short TTL and returns JSON to the client.
7. Cache invalidation or short TTLs keep event information reasonably fresh; seat availability is revalidated at the time of a hold.

### 5.4 POST /api/events/{event_id}/holds flow

1. The client submits the event, selected seat IDs, authentication credentials, and an idempotency key.
2. The load balancer routes the request to a healthy application server.
3. The server validates authentication, event status, request size, seat IDs, and rate limits.
4. The server starts a database transaction and locks the requested seat rows in a consistent order to reduce deadlocks.
5. The database checks that every seat belongs to the event and is available, or that its previous hold has expired.
6. The transaction atomically allocates the seats to the user, records the hold expiry, and creates the corresponding hold/order record.
7. The database commits only if all requested seats can be allocated; otherwise, it rolls back and returns a conflict.
8. The server returns the hold ID and expiry time. The client proceeds to checkout before the hold expires.
9. A background worker releases expired holds, but the hold endpoint always checks current database state rather than relying on the worker or cache.
10. Payment is processed through the provider; verified payment results update order status idempotently, and confirmed tickets are issued.

### 5.5 Availability and avoiding single points of failure

- Run at least two application servers across separate failure domains and have the load balancer health-check them.
- Deploy redundant load-balancer/edge capacity and DNS failover where supported.
- Use database replication, automated backups, and a tested failover process; replication alone is not a substitute for backups.
- Use a highly available Redis deployment or allow cache failure to fall back to the database with rate limits and load protection.
- Deploy redundant workers and a durable queue, using retries and idempotent jobs.
- Monitor queue depth, database locks, waiting-room admission, and payment-provider errors.

The primary database is still a critical dependency for authoritative booking decisions. High availability reduces downtime, while transactions and constraints protect correctness during concurrency.

## 6. Trade-offs

### 6.1 Fairness versus throughput

A waiting room limits the rate at which users enter the purchase flow, reducing overload and giving users a more controlled experience. However, it adds delay and may frustrate users who are ready to purchase. A transparent queue policy, clear status updates, bot protection, and measured admission rates help balance fairness and throughput.

### 6.2 Strong consistency versus read performance

Seat availability and allocation must use strongly consistent database transactions, even if that increases latency during contention. Public event pages and reporting can use caches or read replicas because a slightly stale event description is less dangerous than selling a seat twice.

### 6.3 Temporary holds versus seat utilization

Temporary holds give customers time to pay and prevent simultaneous checkouts from claiming the same seat. Long holds waste inventory when users abandon checkout; short holds can unfairly penalize customers experiencing payment delays. Choose a clear expiry policy, show a countdown, and release expired holds automatically while validating expiry again during checkout.

### 6.4 Synchronous processing versus queues

Processing notifications and cleanup synchronously is simpler but can slow down checkout and make booking availability depend on secondary services. Queuing non-critical work improves resilience and absorbs spikes, but introduces eventual consistency, retry logic, and monitoring requirements. Ticket confirmation should depend on verified payment and durable booking state, not merely successful queue submission.

## Conclusion

TicketHub can support normal traffic and popular-sale spikes by separating public content delivery from transactional seat allocation, controlling admission during peak demand, and scaling stateless application servers horizontally. Most importantly, an atomic database transaction and a unique current-seat allocation guarantee prevent two customers from owning the same seat. Caches, queues, and the waiting room improve performance and resilience, but none replaces database-enforced correctness.