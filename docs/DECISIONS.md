# Design decisions & trade-offs

Each entry gives the decision, the reason, and what I gave up.

### 1. FastAPI + SQLAlchemy 2 + SQLite
- **Why:** FastAPI gives typed request validation and OpenAPI docs (`/docs`) for free. SQLAlchemy keeps SQL portable.
  SQLite handles 10k rows with millisecond queries (see [PERFORMANCE.md](PERFORMANCE.md)) and needs no extra
  infrastructure.
- **Trade-off:** SQLite allows one writer at a time and, on Render's free plan, lives on an ephemeral disk.
  That is fine for a single HR manager and a demo. In production I'd move to Postgres by changing `DATABASE_URL`.
  The queries (including the window-function medians) are portable.

### 2. Money stored as whole-unit integers
- **Why:** floats can't represent money exactly. Annual salaries never need sub-unit precision, so plain integers are
  exact, simple, and sort and aggregate correctly in SQL.
- **Trade-off:** a currency with meaningful minor units for salaries would need `amount_minor` plus an exponent.
  None of the supported currencies needs that.

### 3. Currency is derived from country, not entered
- **Why:** it removes a whole class of data-entry errors (an Indian employee paid in "USD" by mistake). The currency is
  still *stored* on each row, so history stays correct if a mapping ever changes.
- **Rule:** if a country change also changes the currency, the request must include the new salary (422 otherwise).
  Without this, "80,000 GBP" would silently become "80,000 INR". The rule is enforced in the API and surfaced early
  in the UI.

### 4. Static FX rates for cross-country comparison
- **Why:** insights must be deterministic and testable, and HR compares *structure* ("what do we pay in India vs Germany"),
  not to-the-day FX. Rates live in one table in `currency.py` with an as-of date shown in the UI copy.
- **Trade-off:** USD figures drift from market rates. Swapping in a rates provider only touches `USD_RATES`.
- **Presentation:** per-country stats are shown in **local currency**, which is how people are actually paid. USD is
  shown alongside for comparison and used for org-wide totals.

### 5. Aggregations in SQL, medians via window functions
- **Why:** medians and percentiles are more honest than averages for pay, because a few executives skew the mean.
  `ROW_NUMBER()/COUNT() OVER (PARTITION BY …)` computes medians in the database without loading rows into Python,
  and works on both SQLite and Postgres.
- **Lesson:** a cross-check test against `statistics.median` caught that SQLAlchemy 2 compiles `/` as *true*
  division, so even-count medians were wrong. The fix was `//`.

### 6. Salary history written by the service, in the same transaction
- **Why:** the audit trail is the main thing Excel never gave HR. Writing it in the service, not with DB triggers,
  keeps the logic visible and testable, and one commit covers both the update and the history row.
- **Trade-off:** a direct SQL write that bypasses the service skips history. That's acceptable because the API is the
  only writer.

### 7. One container: FastAPI serves the SPA
- **Why:** one deploy, one URL, no CORS, and a health check that covers both halves.
- **Trade-off:** static files aren't on a CDN. That's irrelevant for one internal user.

### 8. Directory state lives in the URL
- **Why:** HR can bookmark or share "Engineers in Germany sorted by salary", and the back button works.
  It also makes the page trivially testable (render with a route and assert the request).

### 9. Validation on both sides, with the API as the authority
- zod mirrors the Pydantic rules for instant feedback. The server still validates everything, and its messages
  (e.g. duplicate email → 409) are shown inline in the form.

### 10. CSV export is in, bulk import is out (for now)
- Export is cheap and fits how HR already works (Excel).
- Import needs column mapping, partial-failure reporting and dedupe, so it's a separate feature (see
  [REQUIREMENTS.md](REQUIREMENTS.md)). Exported cells are sanitized against spreadsheet formula injection.

### 11. No authentication in v1
- There is a single persona and the data is synthetic. Auth is the first production follow-up: SSO via a reverse
  proxy or an OIDC middleware, then role checks on mutating routes.

## What I'd do next
1. Authentication (SSO) and an audit log of *who* changed what.
2. Bulk CSV/Excel import with a dry-run preview.
3. Postgres and a persistent volume. Moving to Postgres is a config change.
4. Compa-ratio / pay bands per role and level, to flag people paid outside their band.
5. Real FX rates with history, to show insights "as of" a date.
