package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
)

type ClubResponse struct {
	Data []ClubAPI `json:"data"`
}

type ClubAPI struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	SubName           string          `json:"sub_name"`
	Address           string          `json:"address"`
	Email             string          `json:"email"`
	Whatsapp          string          `json:"whatsapp"`
	Instagram         string          `json:"instagram"`
	LogoPath          string          `json:"logo_path"`
	LogoName          string          `json:"logo_name"`
	Lat               float64         `json:"lat"`
	Long              float64         `json:"long"`
	LinkMapBusiness   string          `json:"link_map_business"`
	OperatingHours    json.RawMessage `json:"mitra_operating_hours"`
	Price             float64         `json:"price"`
	StartDate         *string         `json:"start_date"`
}

func fetchClubs(token, locationID string) ([]ClubAPI, error) {
	var allClubs []ClubAPI
	page := 1

	for {
		url := fmt.Sprintf("https://api.courtside.id/api/mobile/mitra/nearby-all-new?page=%d&per_page=10&lat=37.4219983&lng=-122.084&location_id=%s", page, locationID)

		respBody, err := apiRequest("GET", url, token, nil)
		if err != nil {
			return nil, fmt.Errorf("fetch clubs failed: %w", err)
		}

		var clubResp ClubResponse
		if err := json.Unmarshal(respBody, &clubResp); err != nil {
			return nil, fmt.Errorf("failed to parse club response: %w", err)
		}

		if len(clubResp.Data) == 0 {
			break
		}

		allClubs = append(allClubs, clubResp.Data...)
		fmt.Printf("  page %d: fetched %d clubs\n", page, len(clubResp.Data))
		page++
	}

	return allClubs, nil
}

func syncClubs(db *sql.DB, clubs []ClubAPI, locationID string) error {
	query := `
		INSERT INTO clubs (id, name, sub_name, address, email, whatsapp, instagram, logo_path, lat, lng, link_map, opening_hours, location_id, price, opening_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
			COALESCE($15, (SELECT MIN((elem->>'created_at')::date) FROM jsonb_array_elements($12::jsonb) AS elem))
		)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			sub_name = EXCLUDED.sub_name,
			address = EXCLUDED.address,
			email = EXCLUDED.email,
			whatsapp = EXCLUDED.whatsapp,
			instagram = EXCLUDED.instagram,
			logo_path = EXCLUDED.logo_path,
			lat = EXCLUDED.lat,
			lng = EXCLUDED.lng,
			link_map = EXCLUDED.link_map,
			opening_hours = EXCLUDED.opening_hours,
			price = EXCLUDED.price,
			opening_date = CASE WHEN clubs.opening_date IS NULL THEN EXCLUDED.opening_date ELSE clubs.opening_date END,
			updated_at = NOW()
	`

	for _, c := range clubs {
		logoPath := c.LogoPath + c.LogoName
		var hours json.RawMessage
		if c.OperatingHours != nil {
			hours = c.OperatingHours
		} else {
			hours = json.RawMessage("[]")
		}

		var startDate sql.NullString
		if c.StartDate != nil && *c.StartDate != "" && *c.StartDate != "null" {
			startDate = sql.NullString{String: *c.StartDate, Valid: true}
		}

		_, err := db.Exec(query,
			c.ID, c.Name, c.SubName, c.Address, c.Email, c.Whatsapp, c.Instagram,
			logoPath, c.Lat, c.Long, c.LinkMapBusiness, hours, locationID, c.Price, startDate,
		)
		if err != nil {
			return fmt.Errorf("failed to upsert club %s: %w", c.ID, err)
		}
	}

	return nil
}

func runClubCrawl(token string, db *sql.DB, locationID string) {
	fmt.Printf("fetching clubs for location %s...\n", locationID)

	clubs, err := fetchClubs(token, locationID)
	if err != nil {
		log.Fatalf("fetch clubs failed: %v", err)
	}
	fmt.Printf("fetched %d clubs\n", len(clubs))

	if err := syncClubs(db, clubs, locationID); err != nil {
		log.Fatalf("sync clubs to db failed: %v", err)
	}
	fmt.Printf("synced %d clubs to database\n", len(clubs))
}

func runClubCrawlAll(token string, db *sql.DB, locationIDs []string) {
	for _, locID := range locationIDs {
		runClubCrawl(token, db, locID)
	}
}