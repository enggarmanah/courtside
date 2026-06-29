package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type CourtResponse struct {
	Data []Court `json:"data"`
}

type Court struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	SubName     string  `json:"sub_name"`
	Address     string  `json:"address"`
	Lat         float64 `json:"lat"`
	Long        float64 `json:"long"`
	Price       float64 `json:"price"`
	Distance    float64 `json:"distance"`
	IsFavorite  bool    `json:"is_favorite"`
	ImagePath   string  `json:"image_path"`
	ImageName   string  `json:"image_name"`
	LogoPath    string  `json:"logo_path"`
	LogoName    string  `json:"logo_name"`
}

func fetchCourts(token, locationID string) ([]Court, error) {
	var allCourts []Court
	page := 1

	for {
		url := fmt.Sprintf("https://api.courtside.id/api/mobile/mitra/nearby-all-new?page=%d&per_page=10&lat=37.4219983&lng=-122.084&location_id=%s", page, locationID)

		respBody, err := apiRequest("GET", url, token, nil)
		if err != nil {
			return nil, fmt.Errorf("fetch courts failed: %w", err)
		}

		var courtResp CourtResponse
		if err := json.Unmarshal(respBody, &courtResp); err != nil {
			return nil, fmt.Errorf("failed to parse court response: %w", err)
		}

		if len(courtResp.Data) == 0 {
			break
		}

		allCourts = append(allCourts, courtResp.Data...)
		fmt.Printf("  page %d: fetched %d courts\n", page, len(courtResp.Data))
		page++
	}

	return allCourts, nil
}

func saveCourts(courts []Court) (string, error) {
	dir := filepath.Join(".", "response")
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to create response directory: %w", err)
	}

	now := time.Now()
	filename := fmt.Sprintf("court-%s.json", now.Format("2006-01-02-1504"))
	filePath := filepath.Join(dir, filename)

	data, err := json.MarshalIndent(courts, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal courts: %w", err)
	}

	if err := os.WriteFile(filePath, data, os.ModePerm); err != nil {
		return "", fmt.Errorf("failed to write court file: %w", err)
	}

	return filePath, nil
}