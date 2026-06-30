package externalapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const baseURL = "https://api.courtside.id/api/mobile"

var dayKeysLower = []string{"sun", "mon", "tue", "wed", "thu", "fri", "sat"}
var dayKeysUpper = []string{"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"}

var (
	sharedClient     *CourtsideClient
	sharedClientOnce sync.Once
	sharedClientMu   sync.Mutex
)

type OperatingHour struct {
	Key        string `json:"key"`
	OpenHours  string `json:"open_hours"`
	CloseHours string `json:"close_hours"`
	Closed     int    `json:"closed"`
}

type CourtsideClient struct {
	httpClient *http.Client
	token      string
	email      string
	password   string
}

type loginResponse struct {
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type courtAvailableReq struct {
	Duration   int    `json:"duration"`
	Date       string `json:"date"`
	StartHours string `json:"start_hours"`
}

type courtAvailableItem struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	StartHour string  `json:"start_hour"`
	EndHour   string  `json:"end_hour"`
	Price     float64 `json:"price"`
}

type courtAvailableResp struct {
	Data []courtAvailableItem `json:"data"`
}

func NewCourtsideClient(email, password string) *CourtsideClient {
	sharedClientOnce.Do(func() {
		sharedClient = &CourtsideClient{
			httpClient: &http.Client{Timeout: 30 * time.Second},
			email:      email,
			password:   password,
		}
	})
	return sharedClient
}

func (c *CourtsideClient) login() error {
	body := map[string]string{"email": c.email, "password": c.password}
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal login request: %w", err)
	}

	respBody, err := c.apiRequest("POST", baseURL+"/auth/login", "", payload)
	if err != nil {
		return fmt.Errorf("login request failed: %w", err)
	}

	var loginResp loginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return fmt.Errorf("failed to parse login response: %w", err)
	}

	c.token = loginResp.AccessToken
	return nil
}

func (c *CourtsideClient) ensureToken() error {
	sharedClientMu.Lock()
	defer sharedClientMu.Unlock()

	if c.token != "" {
		return nil
	}

	return c.login()
}

func (c *CourtsideClient) apiRequest(method, url, token string, body []byte) ([]byte, error) {
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

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == 401 {
		c.token = ""
		return nil, fmt.Errorf("unauthorized (401)")
	}

	return respBody, nil
}

func (c *CourtsideClient) fetchCourtAvailability(clubID, dateStr, startHour string) ([]courtAvailableItem, error) {
	reqBody := courtAvailableReq{
		Duration:   60,
		Date:       dateStr,
		StartHours: startHour,
	}
	payload, _ := json.Marshal(reqBody)

	url := fmt.Sprintf("%s/booking-court/%s/list-court-available", baseURL, clubID)
	respBody, err := c.apiRequest("POST", url, c.token, payload)
	if err != nil {
		return nil, fmt.Errorf("request for hour %s failed: %w", startHour, err)
	}

	var courtResp courtAvailableResp
	if err := json.Unmarshal(respBody, &courtResp); err != nil {
		return nil, fmt.Errorf("failed to parse response for hour %s: %w", startHour, err)
	}

	return courtResp.Data, nil
}

func parseHour(h string) (int, error) {
	parts := strings.Split(h, ".")
	return strconv.Atoi(parts[0])
}

func (c *CourtsideClient) syncClubDate(ctx context.Context, db *sql.DB, clubID, clubName string, date time.Time, openHours []OperatingHour) error {
	dayKey := dayKeysLower[date.Weekday()]

	var match *OperatingHour
	for i := range openHours {
		if openHours[i].Key == dayKey {
			match = &openHours[i]
			break
		}
	}
	if match == nil {
		return fmt.Errorf("no operating hours for %s", dayKey)
	}

	if match.Closed == 1 {
		log.Printf("[externalapi] CLUB %s (%s) closed on %s, skipping", clubName, clubID, date.Format("2006-01-02"))
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

	dateStr := date.Format("2006-01-02")
	day := dayKeysUpper[date.Weekday()]

	courtMap := make(map[string]string)
	hourlyAvailable := make(map[string]map[string]bool)
	var allItems []courtAvailableItem

	for h := openInt; h < closeInt; h++ {
		startHour := fmt.Sprintf("%02d.00", h)

		if err := c.ensureToken(); err != nil {
			return fmt.Errorf("failed to ensure token: %w", err)
		}

		items, err := c.fetchCourtAvailability(clubID, dateStr, startHour)
		if err != nil {
			return fmt.Errorf("fetch availability failed: %w", err)
		}

		if hourlyAvailable[startHour] == nil {
			hourlyAvailable[startHour] = make(map[string]bool)
		}
		for _, item := range items {
			courtMap[item.ID] = item.Name
			hourlyAvailable[startHour][item.ID] = true
			allItems = append(allItems, item)
		}
	}

	if len(courtMap) == 0 {
		log.Printf("[externalapi] CLUB %s (%s) no courts found on %s, skipping", clubName, clubID, dateStr)
		return nil
	}

	if err := syncCourts(db, clubID, allItems); err != nil {
		return fmt.Errorf("sync courts failed: %w", err)
	}

	knownCourtIDs := make([]string, 0, len(courtMap))
	for id := range courtMap {
		knownCourtIDs = append(knownCourtIDs, id)
	}

	if err := syncBookings(db, clubID, knownCourtIDs, hourlyAvailable, day, dateStr, openInt, closeInt); err != nil {
		return fmt.Errorf("sync bookings failed: %w", err)
	}

	log.Printf("[externalapi] CLUB %s (%s) synced on %s: %d courts, %d hours", clubName, clubID, dateStr, len(courtMap), closeInt-openInt)
	return nil
}

func syncCourts(db *sql.DB, clubID string, items []courtAvailableItem) error {
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

func loadCourtPriceMap(db *sql.DB, clubID, day string) (map[string]float64, error) {
	rows, err := db.Query(
		`SELECT time, price FROM prices WHERE club_id = $1 AND day = $2 AND end_period IS NULL`,
		clubID, day,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	prices := make(map[string]float64)
	for rows.Next() {
		var t string
		var price float64
		if err := rows.Scan(&t, &price); err != nil {
			return nil, err
		}
		prices[t] = price
	}
	return prices, rows.Err()
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

func (c *CourtsideClient) SyncDateRange(ctx context.Context, db *sql.DB, clubID, clubName string, fromDate, toDate time.Time, hoursJSON json.RawMessage) error {
	var operatingHours []OperatingHour
	if err := json.Unmarshal(hoursJSON, &operatingHours); err != nil {
		return fmt.Errorf("failed to unmarshal operating hours: %w", err)
	}

	for d := fromDate; !d.After(toDate); d = d.AddDate(0, 0, 1) {
		if err := c.syncClubDate(ctx, db, clubID, clubName, d, operatingHours); err != nil {
			return fmt.Errorf("sync failed for %s: %w", d.Format("2006-01-02"), err)
		}
	}

	return nil
}
