# Performance considerations

Target from the requirements: list and insight endpoints respond in under **300 ms** with 10,000 employees.

## Measured latencies

Measured in-process with FastAPI's TestClient against the seeded 10k database: median of 15 runs after warm-up,
Apple M2, Python 3.14, SQLite in WAL mode. Network time is excluded.

| Endpoint | Median (ms) | p93 (ms) |
|---|---|---|
| List page 1 (default sort) | 2.3 | 2.5 |
| List deep page (page 400) | 2.3 | 2.8 |
| Search `q=patel` | 6.6 | 7.1 |
| Filter country + department, sort by USD salary | 3.3 | 3.5 |
| Insights: overview | 16.4 | 16.9 |
| Insights: by country | 33.3 | 33.6 |
| Insights: job titles in US | 6.6 | 6.9 |
| Insights: by department | 22.9 | 23.2 |
| Insights: distribution | 5.2 | 5.2 |
| CSV export (all 10k rows) | 98.5 | 121.0 |

Seeding 10,000 employees takes **~0.17 s** (batched multi-row inserts of 1,000 rows each).

## What keeps it fast

- **Server-side paging, sorting and filtering.** The browser never receives more than 100 rows, and the page size is
  capped at 100 by the API.
- **Indexes** on `country`, `department`, `job_title`, `salary`, `full_name` and `(country, job_title)`. Unique
  indexes on `email` and `employee_code`.
- **Aggregation in SQL.** Insights return a few dozen rows, never 10k. Medians use window functions, not Python
  sorting.
- **Stable sort with an `id` tie-breaker**, so pages never duplicate or skip rows when sort values tie.
- **Streaming CSV.** The export is written in chunks through a `StreamingResponse`.
- **Frontend:**
  - TanStack Query caches responses and keeps the previous page visible while the next one loads.
  - Search is debounced (300 ms), so it sends one request when the user stops typing.
  - The Insights route (charts) is lazy-loaded.
  - Vendor bundles are split, so app deploys don't invalidate cached MUI/React chunks.
  - The app's own code is ~36 kB gzipped.

## Known limits and how they'd scale

- **Search** uses `LIKE '%term%'`, which can't use a B-tree index. It's a full scan, but 10k rows take ~7 ms.
  At 1M+ rows I'd switch to SQLite FTS5 or Postgres `pg_trgm`.
- **Insights by country** runs three queries (stats, local median, USD median). At larger scale, cache them
  (they change only on writes) or precompute them into a summary table.
- **Deep OFFSET paging** is linear in the offset. That's fine at 10k (page 400 = 2.3 ms). For very large tables I'd
  use keyset pagination.
- **SQLite allows a single writer.** That's appropriate for one HR manager. Concurrent editors would need Postgres.
