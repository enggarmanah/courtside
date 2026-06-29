package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

var dayKeysLower = []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}
var dayKeysUpper = []string{"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"}

type OperatingHour struct {
	Key        string `json:"key"`
	OpenHours  string `json:"open_hours"`
	CloseHours string `json:"close_hours"`
	Closed     int    `json:"closed"`
}

type CourtAvailableReq struct {
	Duration   int    `json:"duration"`
	Date       string `json:"date"`
	StartHours string `json:"start_hours"`
}

type CourtAvailableItem struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	StartHour string  `json:"start_hour"`
	EndHour   string  `json:"end_hour"`
	Price     float64 `json:"price"`
}

type CourtAvailableResp struct {
	Data []CourtAvailableItem `json:"data"`
}

type BookTimeItem struct {
	Time  string  `json:"time"`
	Price float64 `json:"price"`
}

type BookTimeResp struct {
	Closed bool           `json:"closed"`
	Data   []BookTimeItem `json:"data"`
}

type BookTimeReq struct {
	Date string `json:"date"`
}

func parseHour(h string) (int, error) {
	parts := strings.Split(h, ".")
	return strconv.Atoi(parts[0])
}

func crawlClub(token string, db *sql.DB, clubID, clubName string, hoursJSON json.RawMessage, today time.Time) error {
	var openingDate sql.NullTime
	if err := db.QueryRow("SELECT opening_date FROM clubs WHERE id = $1", clubID).Scan(&openingDate); err == nil && openingDate.Valid && today.Before(openingDate.Time) {
		log.Printf("%s CLUB %s (%s) opening_date %s is after reference date %s, skipping", time.Now().Format(time.RFC3339), clubName, clubID, openingDate.Time.Format("2006-01-02"), today.Format("2006-01-02"))
		return nil
	}

	var operatingHours []OperatingHour
	if err := json.Unmarshal(hoursJSON, &operatingHours); err != nil {
		return fmt.Errorf("failed to unmarshal operating hours: %w", err)
	}

	key := dayKeysLower[today.Weekday()]

	var match *OperatingHour
	for _, h := range operatingHours {
		if h.Key == key {
			match = &h
			break
		}
	}

	if match == nil {
		return fmt.Errorf("no operating hours for %s", key)
	}

	if match.Closed == 1 {
		log.Printf("%s CLUB %s (%s) closed today, skipping", time.Now().Format(time.RFC3339), clubName, clubID)
		return nil
	}

	openInt, err := parseHour(match.OpenHours)
	if err != nil {
		return fmt.Errorf("failed to parse open_hours %s: %w", match.OpenHours, err)
	}

	closeInt, err := parseHour(match.CloseHours)
	if err != nil {
		return fmt.Errorf("failed to parse close_hours %s: %w", match.CloseHours, err)
	}

	date := today.Format("2006-01-02")

	day := dayKeysUpper[today.Weekday()]

	courtMap := make(map[string]string)
	hourlyAvailable := make(map[string]map[string]bool)
	var allItems []CourtAvailableItem

	for h := openInt; h < closeInt; h++ {
		startHour := fmt.Sprintf("%02d.00", h)

		reqBody := CourtAvailableReq{
			Duration:   60,
			Date:       date,
			StartHours: startHour,
		}
		payload, _ := json.Marshal(reqBody)

		url := fmt.Sprintf("https://api.courtside.id/api/mobile/booking-court/%s/list-court-available", clubID)
		respBody, err := apiRequest("POST", url, token, payload)
		if err != nil {
			return fmt.Errorf("request for hour %s failed: %w", startHour, err)
		}

		var courtResp CourtAvailableResp
		if err := json.Unmarshal(respBody, &courtResp); err != nil {
			return fmt.Errorf("failed to parse response for hour %s: %w", startHour, err)
		}

		log.Printf("%s %s hour %s: %d courts available", time.Now().Format(time.RFC3339), clubName, startHour, len(courtResp.Data))

		if hourlyAvailable[startHour] == nil {
			hourlyAvailable[startHour] = make(map[string]bool)
		}
		for _, item := range courtResp.Data {
			courtMap[item.ID] = item.Name
			hourlyAvailable[startHour][item.ID] = true
			allItems = append(allItems, item)
		}
	}

	if len(courtMap) == 0 {
		log.Printf("%s CLUB %s (%s) no courts found, skipping", time.Now().Format(time.RFC3339), clubName, clubID)
		return nil
	}

	if err := syncCourts(db, clubID, allItems); err != nil {
		return fmt.Errorf("sync courts failed: %w", err)
	}

	knownCourtIDs := make([]string, 0, len(courtMap))
	for id := range courtMap {
		knownCourtIDs = append(knownCourtIDs, id)
	}

	if err := syncBookings(db, clubID, knownCourtIDs, hourlyAvailable, day, date, openInt, closeInt); err != nil {
		return fmt.Errorf("sync bookings failed: %w", err)
	}

	log.Printf("%s CLUB %s (%s) done on %s: %d courts, %d hours checked", time.Now().Format(time.RFC3339), clubName, clubID, date, len(courtMap), closeInt-openInt)
	return nil
}

func syncCourts(db *sql.DB, clubID string, items []CourtAvailableItem) error {
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	seen := make(map[string]bool)
	query := `
		INSERT INTO courts (id, club_id, name)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
	`
	for _, item := range items {
		if seen[item.ID] {
			continue
		}
		seen[item.ID] = true
		if _, err := db.Exec(query, item.ID, clubID, item.Name); err != nil {
			return fmt.Errorf("failed to upsert court %s: %w", item.ID, err)
		}
	}
	return nil
}

func syncBookings(db *sql.DB, clubID string, knownCourtIDs []string, hourlyAvailable map[string]map[string]bool, day, date string, openHour, closeHour int) error {
	courtPriceMap, err := loadCourtPriceMap(db, clubID, day)
	if err != nil {
		return fmt.Errorf("load court prices failed: %w", err)
	}

	if _, err := db.Exec("DELETE FROM bookings WHERE club_id = $1 AND booking_time::date = $2", clubID, date); err != nil {
		return fmt.Errorf("failed to delete existing bookings for club %s on %s: %w", clubID, date, err)
	}

	query := `
		INSERT INTO bookings (id, club_id, court_id, booking_time, price)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (club_id, court_id, booking_time) DO NOTHING
	`
	for h := openHour; h < closeHour; h++ {
		startHour := fmt.Sprintf("%02d.00", h)
		available := hourlyAvailable[startHour]
		for _, courtID := range knownCourtIDs {
			if available == nil || !available[courtID] {
				bookingTime := fmt.Sprintf("%s %s:00", date, startHour[:2])
				price := courtPriceMap[startHour]
				id := uuid.New().String()
				if _, err := db.Exec(query, id, clubID, courtID, bookingTime, price); err != nil {
					return fmt.Errorf("failed to insert booking for court %s hour %s: %w", courtID, startHour, err)
				}
			}
		}
	}
	return nil
}

func runCourtsCrawl(token string, db *sql.DB, today time.Time, locationIDs []string) {
	start := time.Now()

	var rows *sql.Rows
	var err error
	if len(locationIDs) > 0 {
		args := make([]interface{}, len(locationIDs))
		placeholders := make([]string, len(locationIDs))
		for i, locID := range locationIDs {
			args[i] = locID
			placeholders[i] = fmt.Sprintf("$%d", i+1)
		}
		query := fmt.Sprintf("SELECT id, name, opening_hours FROM clubs WHERE location_id IN (%s)", strings.Join(placeholders, ","))
		rows, err = db.Query(query, args...)
	} else {
		rows, err = db.Query("SELECT id, name, opening_hours FROM clubs")
	}
	if err != nil {
		log.Fatalf("query clubs failed: %v", err)
	}
	defer rows.Close()

	type clubData struct {
		id, name string
		hoursJSON json.RawMessage
	}
	var clubs []clubData
	for rows.Next() {
		var c clubData
		if err := rows.Scan(&c.id, &c.name, &c.hoursJSON); err != nil {
			log.Fatalf("scan club row failed: %v", err)
		}
		clubs = append(clubs, c)
	}
	if err := rows.Err(); err != nil {
		log.Fatalf("rows iteration error: %v", err)
	}

	total := len(clubs)
	log.Printf("%s starting booking crawl for %d clubs", time.Now().Format(time.RFC3339), total)

	var processed int64
	workCh := make(chan clubData, total)
	var wg sync.WaitGroup

	for w := 0; w < 5; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for c := range workCh {
				if err := crawlClub(token, db, c.id, c.name, c.hoursJSON, today); err != nil {
					log.Printf("%s [W%d] ERROR crawling club %s (%s): %v", time.Now().Format(time.RFC3339), workerID, c.name, c.id, err)
				}
				n := atomic.AddInt64(&processed, 1)
				log.Printf("%s %d/%d processed", time.Now().Format(time.RFC3339), n, total)
			}
		}(w)
	}

	for _, c := range clubs {
		workCh <- c
	}
	close(workCh)

	wg.Wait()

	log.Printf("%s finished crawling %d/%d clubs, duration %s", time.Now().Format(time.RFC3339), atomic.LoadInt64(&processed), total, formatDuration(time.Since(start)))
}

func runBookingCrawl(token string, db *sql.DB, clubID string, today time.Time) {
	start := time.Now()
	var name string
	var hoursJSON json.RawMessage
	err := db.QueryRow("SELECT name, opening_hours FROM clubs WHERE id = $1", clubID).Scan(&name, &hoursJSON)
	if err != nil {
		log.Fatalf("failed to load club %s: %v", clubID, err)
	}

	log.Printf("%s booking crawl for %s (%s) on %s", time.Now().Format(time.RFC3339), name, clubID, today.Format("2006-01-02"))

	if err := crawlClub(token, db, clubID, name, hoursJSON, today); err != nil {
		log.Printf("%s ERROR crawling club %s (%s): %v", time.Now().Format(time.RFC3339), name, clubID, err)
	}

	log.Printf("%s finished booking crawl for %s (%s), duration %s", time.Now().Format(time.RFC3339), name, clubID, formatDuration(time.Since(start)))
}

func runBookingCrawlPartial(token string, db *sql.DB, clubIDs []string, today time.Time) {
	start := time.Now()
	total := len(clubIDs)
	log.Printf("%s starting partial booking crawl for %d clubs", time.Now().Format(time.RFC3339), total)

	var processed int64
	workCh := make(chan string, total)
	var wg sync.WaitGroup

	for w := 0; w < 5; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for clubID := range workCh {
				var name string
				var hoursJSON json.RawMessage
				err := db.QueryRow("SELECT name, opening_hours FROM clubs WHERE id = $1", clubID).Scan(&name, &hoursJSON)
				if err != nil {
					log.Printf("%s [W%d] ERROR loading club %s: %v", time.Now().Format(time.RFC3339), workerID, clubID, err)
					continue
				}

				if err := crawlClub(token, db, clubID, name, hoursJSON, today); err != nil {
					log.Printf("%s [W%d] ERROR crawling club %s (%s): %v", time.Now().Format(time.RFC3339), workerID, name, clubID, err)
				}
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

	log.Printf("%s finished partial booking crawl for %d/%d clubs, duration %s", time.Now().Format(time.RFC3339), atomic.LoadInt64(&processed), total, formatDuration(time.Since(start)))
}

func formatDuration(d time.Duration) string {
	d = d.Round(time.Second)
	h := d / time.Hour
	d -= h * time.Hour
	m := d / time.Minute
	d -= m * time.Minute
	s := d / time.Second
	return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
}