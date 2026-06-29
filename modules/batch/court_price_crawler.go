package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

func crawlClubDayPrices(token string, db *sql.DB, clubID, date, dayKey string) error {
	reqBody := BookTimeReq{
		Date: date,
	}
	payload, _ := json.Marshal(reqBody)

	url := fmt.Sprintf("https://api.courtside.id/api/mobile/booking-court/%s/list-book-time", clubID)
	respBody, err := apiRequest("POST", url, token, payload)
	if err != nil {
		return fmt.Errorf("request for date %s failed: %w", date, err)
	}

	var resp BookTimeResp
	if err := json.Unmarshal(respBody, &resp); err != nil {
		return fmt.Errorf("failed to parse response for date %s: %w", date, err)
	}

	if resp.Closed {
		log.Printf("%s %s closed on %s, skipping", time.Now().Format(time.RFC3339), clubID, date)
		return nil
	}

	if len(resp.Data) == 0 {
		log.Printf("%s %s no time slots for %s, skipping", time.Now().Format(time.RFC3339), clubID, date)
		return nil
	}

	day := dayKeysUpper[weekdayIndex(dayKey)]

	log.Printf("%s %s %s: %d time slots", time.Now().Format(time.RFC3339), clubID, date, len(resp.Data))

	if err := syncCourtPricesWithHistory(db, clubID, day, date, resp.Data); err != nil {
		return fmt.Errorf("sync court prices with history failed: %w", err)
	}

	log.Printf("%s %s %s done", time.Now().Format(time.RFC3339), clubID, date)
	return nil
}

func weekdayIndex(key string) int {
	for i, k := range dayKeysLower {
		if k == key {
			return i
		}
	}
	return 0
}

func crawlClubWeekPrices(token string, db *sql.DB, clubID string, today time.Time) error {
	for d := 1; d <= 7; d++ {
		date := today.AddDate(0, 0, d)
		key := dayKeysLower[date.Weekday()]
		dateStr := date.Format("2006-01-02")

		log.Printf("%s %s crawling prices for %s (%s)", time.Now().Format(time.RFC3339), clubID, dateStr, key)

		if err := crawlClubDayPrices(token, db, clubID, dateStr, key); err != nil {
			log.Printf("%s ERROR crawling %s %s: %v", time.Now().Format(time.RFC3339), clubID, dateStr, err)
		}
	}
	return nil
}

func runCourtPriceCrawl(token string, db *sql.DB, clubID string) {
	start := time.Now()
	log.Printf("%s starting 7-day price crawl for club %s", time.Now().Format(time.RFC3339), clubID)

	today := time.Now()
	if err := crawlClubWeekPrices(token, db, clubID, today); err != nil {
		log.Printf("%s ERROR crawling week prices for club %s: %v", time.Now().Format(time.RFC3339), clubID, err)
	}

	log.Printf("%s finished 7-day price crawl for club %s, duration %s", time.Now().Format(time.RFC3339), clubID, formatDuration(time.Since(start)))
}

func runCourtPriceCrawlAll(token string, db *sql.DB, locationIDs []string) {
	start := time.Now()
	if len(locationIDs) == 0 {
		log.Printf("no locations configured, skipping")
		return
	}
	args := make([]interface{}, len(locationIDs))
	placeholders := make([]string, len(locationIDs))
	for i, locID := range locationIDs {
		args[i] = locID
		placeholders[i] = fmt.Sprintf("$%d", i+1)
	}
	query := fmt.Sprintf("SELECT id FROM clubs WHERE location_id IN (%s)", strings.Join(placeholders, ","))
	rows, err := db.Query(query, args...)
	if err != nil {
		log.Fatalf("query clubs failed: %v", err)
	}
	defer rows.Close()

	var clubIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			log.Fatalf("scan club row failed: %v", err)
		}
		clubIDs = append(clubIDs, id)
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("rows iteration error: %v", err)
	}

	total := len(clubIDs)
	log.Printf("%s starting 7-day price crawl for %d clubs", time.Now().Format(time.RFC3339), total)

	var processed int64
	workCh := make(chan string, total)
	var wg sync.WaitGroup

	for w := 0; w < 5; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for clubID := range workCh {
				runCourtPriceCrawl(token, db, clubID)
				n := atomic.AddInt64(&processed, 1)
				log.Printf("%s %d/%d processed", time.Now().Format(time.RFC3339), n, total)
			}
		}(w)
	}

	for _, clubID := range clubIDs {
		workCh <- clubID
	}
	close(workCh)

	wg.Wait()

	log.Printf("%s finished 7-day price crawl for %d/%d clubs, duration %s", time.Now().Format(time.RFC3339), atomic.LoadInt64(&processed), total, formatDuration(time.Since(start)))
}