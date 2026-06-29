# Plan: Court Availability Crawler

## Goals

1. Add UNIQUE constraint on `bookings(club_id, court_id, booking_time)`
2. Drop and recreate the bookings table
3. Create a crawler that for each club in the `clubs` table: hits the court-available API per hour, upserts `courts`, `court_prices`, and `bookings`
4. 3-second delay between clubs; timestamped logs

## Phase 1 — DB schema update

**File: `db/base/05_bookings.sql`**
- Add `UNIQUE (club_id, court_id, booking_time)` after `booking_time TIMESTAMP NOT NULL,`
- Execute via one-off SQL: `DROP TABLE IF EXISTS bookings CASCADE;` then `\i base/05_bookings.sql`

**File: `db/setup.sql`**
- No change needed — already uses `\i base/05_bookings.sql`

## Phase 2 — New file: `api/courts_crawler.go`

Create `courts_crawler.go` in `package main` with:

| Code              | Purpose |
|---|---|
| `OperatingHour` struct | Fields: `Key`, `OpenHours`, `CloseHours`, `Closed` — for unmarshalling club `opening_hours` JSONB |
| `CourtAvailableReq` struct | `{ duration: 60, date: String, start_hours: String }` |
| `CourtAvailableItem` struct | Fields: `id`, `name`, `start_hour`, `end_hour`, `price` |
| `CourtAvailableResp` struct | `{ data: []CourtAvailableItem }` |
| `crawlClub(token, db, clubID, clubName, hoursJSON, today)` | Orchestrates one club |
| `syncCourts(db, clubID, items []CourtAvailableItem)` | UPSERT into `courts` — `ON CONFLICT (id) DO UPDATE SET name` |
| `syncCourtPrices(db, clubID, items []CourtAvailableItem)` | UPSERT into `court_prices` — generate UUID per row, `ON CONFLICT (club_id, court_id, time) DO UPDATE SET price` |
| `syncBookings(db, clubID, knownCourtIDs []string, hourlyAvailable map[string]map[string]bool, today)` | For each hour×court: if court absent in hourlyAvailable[hour] → INSERT into `bookings`, `ON CONFLICT (club_id, court_id, booking_time) DO NOTHING` |

**Crawl algorithm (`crawlClub`)**:
1. Unmarshal `hoursJSON` into `[]OperatingHour`
2. Map today's weekday to day key: `["sun","mon","tue","wed","thu","fri","sat"]` (Go Sunday=0)
3. Find matching entry; if `closed == 1`, log skip and return
4. Parse `open_hours` (e.g. "06.00") → hour int, `close_hours` (e.g. "24.00") → hour int
5. Iterate `h := open; h < close; h++`:
   - `startHour := fmt.Sprintf("%02d.00", h)`
   - POST `https://api.courtside.id/api/mobile/booking-court/{clubID}/list-court-available` with body `{"duration":60, "date":"yyyy-MM-dd", "start_hours": startHour}`
   - Bearer token header
   - Parse response; collect items in a slice
6. Aggregate:
   - `courtMap[id] = name`
   - `hourlyAvailable[hour][courtID] = true`
   - `priceMap[(courtID, hour)] = price`
7. Call `syncCourts(db, clubID, ...)` then `syncCourtPrices(db, clubID, ...)`
8. Build `knownCourtIDs` from `courtMap` keys; call `syncBookings(...)`

## Phase 3 — Update `api/main.go`

Add CLI dispatch for `crawler.exe courts`:

```
crawler.exe         → locations + clubs + court crawl (current pipeline)
crawler.exe setup   → DB setup (unchanged)
crawler.exe courts  → skip location/club fetch, read clubs from DB and crawl courts
```

The `courts` subcommand flow:
1. `loadConfig`, get token via `login()`, open DB
2. `rows, _ := db.Query("SELECT id, name, opening_hours FROM clubs")`
3. For each row → `crawlClub(token, db, id, name, hoursJSON, time.Now())`
4. `time.Sleep(3 * time.Second)` between clubs
5. All log lines prefixed with `time.Now().Format(time.RFC3339)`

## Phase 4 — Execution steps

1. `cd api`
2. Run SQL to drop and recreate bookings table using `setup.go` mechanism or direct `db.Exec`
3. `go get github.com/google/uuid` (for generating court_prices UUIDs)
4. `go build -o crawler.exe .`
5. `.\crawler.exe courts`

## Validation

- Logs show timestamp for each club processed
- Verify `courts` table has court rows for Castle Padel (3 courts)
- Verify `court_prices` has price rows for each court×time combination
- Verify `bookings` is empty on first run (all courts available) or has rows for booked slots

## Design decisions (confirmed)

- Close_hours=24.00 → iterate up to 23.00 (exclusive upper bound)
- Bookings use `ON CONFLICT DO NOTHING` to handle re-runs
- DB-only output; no JSON files for court availability
- UUID v4 for court_prices rows (generated via `github.com/google/uuid`)
