# Plan: Court Price Crawler Refactor

## Goal
Add price-period tracking to `court_prices`, extract price logic into modular files, and add a `court_price <club_id>` CLI command that fetches 7-day price data.

---

## 1. Database Schema — `db/base/04_court_prices.sql`

- Add `start_period TIMESTAMP NOT NULL DEFAULT NOW()`
- Add `end_period TIMESTAMP` (nullable — NULL means "current/latest")
- Change UNIQUE to `(club_id, court_id, day, time, start_period, end_period)`

**Semantics:**
- Active/current price: `start_period <= NOW() AND (end_period IS NULL OR NOW() < end_period)`
- When price changes: close current record by setting `end_period = NOW()`, then INSERT new record with `start_period = NOW()`, `end_period = NULL`

---

## 2. New File — `api/court_price.go` (domain layer)

Functions extracted and moved here from `courts_crawler.go`:

| Function | Description |
|---|---|
| `getCurrentPrice(db, clubID, courtID, day, time)` | Query the active price record (end_period IS NULL, start_period <= NOW()). Returns `*float64` (nil if no active price). |
| `syncCourtPricesWithHistory(db, clubID, day, items []CourtAvailableItem)` | For each (court_id, time): compare API price vs DB current price. If different: UPDATE current record SET end_period = NOW(), then INSERT new row with new price and start_period = NOW(). If same: no-op. |
| `loadCourtPriceMap(db, clubID, day)` | Relocated unchanged. Queries active prices and returns `map[string]float64`. |

---

## 3. New File — `api/court_price_crawler.go` (crawling logic)

### `crawlClubDayPrices(token, db, clubID, date, dayKey, operatingHours []OperatingHour) error`
- For each hour from open to close on that date:
  - Call `list-court-available` with the given date
  - Collect `CourtAvailableItem` results
- Call `syncCourtPricesWithHistory` with the collected items

### `crawlClubWeekPrices(token, db, clubID, today time.Time) error`
- Loop through dates: `today+1` .. `today+8` (7 dates)
- For each date:
  - Resolve day key (`sun`..`sat`) from the date's weekday
  - Find matching `OperatingHour` from the club's `opening_hours`
  - Call `crawlClubDayPrices`
  - Sleep 3s between days to avoid rate limiting

### `runCourtPriceCrawl(token, db, clubID string)`
- Load club's `name` and `opening_hours` from DB by `clubID`
- Call `crawlClubWeekPrices`

---

## 4. Modify — `api/courts_crawler.go`

### Remove
- `syncCourtPrices` function (moved to `court_price.go` with new period logic)
- `loadCourtPriceMap` function (moved to `court_price.go`)
- `syncCourtPrices` call from `crawlClub`

### Keep unchanged
- Shared types: `OperatingHour`, `CourtAvailableReq`, `CourtAvailableItem`, `CourtAvailableResp`
- Shared vars: `dayKeysLower`, `dayKeysUpper`
- Shared funcs: `parseHour`
- `crawlClub` (now only syncs courts + bookings)
- `syncCourts`
- `syncBookings` (still reads prices via `loadCourtPriceMap` from DB)
- `runCourtsCrawl`

---

## 5. Modify — `api/main.go`

Add before the existing `fmt.Println("fetching locations...")` block:

```go
if len(os.Args) > 2 && os.Args[1] == "court_price" {
    runCourtPriceCrawl(loginResp.AccessToken, db, os.Args[2])
    return
}
```

---

## Validation

1. `go build .` — must compile without errors
2. `go run . setup` — applies new schema (DROP + CREATE)
3. `go run . court_price <club_id>` — fetches 7-day prices, logs progress
4. `go run . courts` — runs courts crawl (should still work, no price write)

## Migration Note

Existing `court_prices` rows lack `start_period`/`end_period`. The table is DROP+CREATE on `setup`, so re-running setup will destroy old data. Consider backing up or writing a one-time migration script if production data exists.

## Open Questions (out of scope for this plan)
- Weekly scheduler infrastructure to trigger `court_price` automatically is not defined here
- No rate-limit / retry logic beyond the existing 3s sleep pattern