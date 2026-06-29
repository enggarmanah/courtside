package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
)

type Location struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func fetchLocations(token string) ([]Location, error) {
	respBody, err := apiRequest("GET", "https://api.courtside.id/api/mobile/mitra/location", token, nil)
	if err != nil {
		return nil, fmt.Errorf("fetch locations failed: %w", err)
	}

	var locations []Location
	if err := json.Unmarshal(respBody, &locations); err != nil {
		return nil, fmt.Errorf("failed to parse location response: %w", err)
	}

	return locations, nil
}

func saveLocations(locations []Location) (string, error) {
	dir := filepath.Join(".", "response")
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to create response directory: %w", err)
	}

	now := time.Now()
	filename := fmt.Sprintf("location-%s.json", now.Format("2006-01-02-1504"))
	filePath := filepath.Join(dir, filename)

	data, err := json.MarshalIndent(locations, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal locations: %w", err)
	}

	if err := os.WriteFile(filePath, data, os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to write location file: %w", err)
	}

	return filePath, nil
}

func syncLocations(db *sql.DB, locations []Location) error {
	query := `
		INSERT INTO locations (id, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			updated_at = EXCLUDED.updated_at
	`

	for _, loc := range locations {
		_, err := db.Exec(query, loc.ID, loc.Name, loc.CreatedAt, loc.UpdatedAt)
		if err != nil {
			return fmt.Errorf("failed to upsert location %s: %w", loc.ID, err)
		}
	}

	return nil
}

func runLocationCrawl(token string, db *sql.DB) {
	fmt.Println("fetching locations...")

	locations, err := fetchLocations(token)
	if err != nil {
		log.Fatalf("fetch locations failed: %v", err)
	}
	fmt.Printf("fetched %d locations\n", len(locations))

	filePath, err := saveLocations(locations)
	if err != nil {
		log.Fatalf("save locations failed: %v", err)
	}
	fmt.Printf("locations saved to %s\n", filePath)

	if err := syncLocations(db, locations); err != nil {
		log.Fatalf("sync locations to db failed: %v", err)
	}
	fmt.Printf("synced %d locations to database\n", len(locations))
}