# Plan: Source bookings.price from court_prices + HTTP utility + code cleanup

## Goal

1. Populate `bookings.price` from `court_prices` table instead of the `list-book-time` API
2. Create a shared `apiRequest` utility with a timed HTTP client to eliminate redundant HTTP boilerplate across all files
3. Remove dead code accumulated during the previous iteration

## Phase 1 — Create `api/http.go` (utility file)

**New file** `api/http.go` in `package main`:

```go
package main

import (
    "bytes"
    "fmt"
    "io"
    "net/http"
    "time"
)

var httpClient = &http.Client{Timeout: 30 * time.Second}

func apiRequest(method, url, token string, body []byte) ([]byte, error) {
    var bodyReader io.Reader
    if body != nil {
        bodyReader = bytes.NewReader(body)
    }
    req, err := http.NewRequest(method, url, bodyReader)
    if err != nil {
        return nil, fmt.Errorf("failed to create request: %w", err)
    }
    req.Header.Set("accept", "application/json")
    req.Header.Set("user-agent", "Courtside/1.1.34")
    if token != "" {
        req.Header.Set("authorization", "Bearer "+token)
    }
    if method == "POST" {
        req.Header.Set("content-type", "application/json")
    }

    resp, err := httpClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    respBody, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("failed to read response: %w", err)
    }
    return respBody, nil
}
```

Design decisions:
- `token` can be empty → skips `authorization` header (needed for `/auth/login` which has no token yet)
- `body` can be `nil` → no body sent (for GET requests)
- 30-second timeout on all API calls
- `defer resp.Body.Close()` guarantees cleanup even on error

## Phase 2 — Refactor existing files to use `apiRequest`

### `api/authentication.go` — `login`

- Remove `bytes`, `io`, `net/http` imports
- Replace HTTP request block (lines 30-48) with:
  ```go
  respBody, err := apiRequest("POST", "https://api.courtside.id/api/mobile/auth/login", "", payload)
  if err != nil {
      return nil, fmt.Errorf("login failed: %w", err)
  }
  ```

### `api/location.go` — `fetchLocations`

- Remove `io`, `net/http` imports
- Replace lines 22-40 with:
  ```go
  respBody, err := apiRequest("GET", "https://api.courtside.id/api/mobile/mitra/location", token, nil)
  if err != nil {
      return nil, fmt.Errorf("fetch locations failed: %w", err)
  }
  ```

### `api/club.go` — `fetchClubs`

- Remove `io`, `net/http` imports
- Replace HTTP block inside the loop (lines 38-56) with:
  ```go
  respBody, err := apiRequest("GET", url, token, nil)
  if err != nil {
      return nil, fmt.Errorf("fetch clubs failed: %w", err)
  }
  ```

### `api/court.go` — `fetchCourts`

- Remove `io`, `net/http` imports
- Replace HTTP block inside the loop (lines 40-58) with:
  ```go
  respBody, err := apiRequest("GET", url, token, nil)
  if err != nil {
      return nil, fmt.Errorf("fetch courts failed: %w", err)
  }
  ```

## Phase 3 — `api/courts_crawler.go` cleanup + booking price fix

### 3a. Remove dead code

- Delete `BookTimeItem` struct, `BookTimeResp` struct, `fetchTimeSlotPrices` function
- Remove `priceMap` variable (line 139 in current file) — it was only used by the old `syncBookings(timeSlotPrices)` call
- Replace `len(priceMap)` in the final log line with `len(allItems)`
- Remove the `fetchTimeSlotPrices` call (lines 132-135)
- Remove unused imports (`bytes`, `io`, `net/http` — verify after changes)

### 3b. Promote repeated slices to package-level constants

Near the top of the file, add:
```go
var dayKeysLower = []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}
var dayKeysUpper = []string{"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"}
```

In `crawlClub`:
- `dayKeys := []string{...}` → reference `dayKeysLower`
- `dayKeysUpper := []string{...}` → reference `dayKeysUpper`

### 3c. Refactor hourly `list-court-available` POST to use `apiRequest`

Replace the manual HTTP block inside the hourly loop (lines 145-167) with:
```go
respBody, err := apiRequest("POST", url, token, payload)
if err != nil {
    return fmt.Errorf("request for hour %s failed: %w", startHour, err)
}
```

### 3d. Add `loadCourtPriceMap` function

```go
func loadCourtPriceMap(db *sql.DB, clubID, day string) (map[string]float64, error) {
    rows, err := db.Query("SELECT court_id, time, price FROM court_prices WHERE club_id = $1 AND day = $2", clubID, day)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    prices := make(map[string]float64)
    for rows.Next() {
        var courtID, time string
        var price float64
        if err := rows.Scan(&courtID, &time, &price); err != nil {
            return nil, err
        }
        prices[courtID+"|"+time] = price
    }
    return prices, rows.Err()
}
```

### 3e. Update `syncBookings` signature and body

- Remove `timeSlotPrices map[string]float64` parameter
- Add `day string` parameter
- Inside `syncBookings`, call `loadCourtPriceMap(db, clubID, day)` first and return its error
- Replace `price := timeSlotPrices[startHour]` with `price := courtPriceMap[courtID+"|"+startHour]`

### 3f. Update `crawlClub` call site

Change the `syncBookings` call from:
```go
syncBookings(db, clubID, knownCourtIDs, hourlyAvailable, timeSlotPrices, date, openInt, closeInt)
```
To:
```go
syncBookings(db, clubID, knownCourtIDs, hourlyAvailable, day, date, openInt, closeInt)
```

### 3g. Add `rows.Err()` check in `runCourtsCrawl`

After the `for rows.Next()` loop:
```go
if err := rows.Err(); err != nil {
    log.Fatalf("rows iteration error: %v", err)
}
```

## No DB schema changes

`court_prices` already has `day VARCHAR(3)` and `UNIQUE (club_id, court_id, day, time)`.

## Execution steps

1. Create `api/http.go`
2. Edit `api/authentication.go` — refactor login, clean imports
3. Edit `api/location.go` — refactor fetchLocations, clean imports
4. Edit `api/club.go` — refactor fetchClubs, clean imports
5. Edit `api/court.go` — refactor fetchCourts, clean imports
6. Edit `api/courts_crawler.go` — all Phase 3 changes
7. `cd api; go build -o crawler.exe .`
8. `.\crawler.exe courts`

## Verification

- `go build` succeeds with no compilation errors (unused imports/variables/functions)
- `login`, `fetchLocations`, `fetchClubs`, `fetchCourts` still work (test by running full pipeline)
- After courts crawl: `SELECT COUNT(*) FROM bookings WHERE price IS NOT NULL;` > 0
- Spot-check: `SELECT b.price, cp.price FROM bookings b JOIN court_prices cp ON cp.club_id = b.club_id AND cp.court_id = b.court_id AND cp.time = TO_CHAR(b.booking_time, 'HH24')||'.00' WHERE b.price != cp.price;` returns 0 rows
- No references to `fetchTimeSlotPrices`, `BookTimeItem`, `BookTimeResp`, `priceMap` anywhere