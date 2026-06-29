package main

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func getCurrentPrice(db *sql.DB, clubID, day, timeStr string) (*float64, error) {
	var price float64
	err := db.QueryRow(
		`SELECT price FROM prices WHERE club_id = $1 AND day = $2 AND time = $3 AND end_period IS NULL`,
		clubID, day, timeStr,
	).Scan(&price)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &price, nil
}

func syncCourtPricesWithHistory(db *sql.DB, clubID, day, dateStr string, items []BookTimeItem) error {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	periodStart := time.Now().In(loc).Format("2006-01-02") + " 00:00:00+07"
	_ = dateStr // crawled date for context only
	seen := make(map[string]bool)
	for _, item := range items {
		if seen[item.Time] {
			continue
		}
		seen[item.Time] = true

		currentPrice, err := getCurrentPrice(db, clubID, day, item.Time)
		if err != nil {
			return fmt.Errorf("failed to get current price at %s: %w", item.Time, err)
		}

		if currentPrice != nil && *currentPrice == item.Price {
			continue
		}

		if currentPrice != nil {
			if _, err := db.Exec(
				`UPDATE prices SET end_period = $1::timestamptz, updated_at = NOW() WHERE club_id = $2 AND day = $3 AND time = $4 AND end_period IS NULL`,
				periodStart, clubID, day, item.Time,
			); err != nil {
				return fmt.Errorf("failed to close current price at %s: %w", item.Time, err)
			}
		}

		id := uuid.New().String()
		if _, err := db.Exec(
			`INSERT INTO prices (id, club_id, day, time, start_period, end_period, price) VALUES ($1, $2, $3, $4, $5::timestamptz, NULL, $6)`,
			id, clubID, day, item.Time, periodStart, item.Price,
		); err != nil {
			return fmt.Errorf("failed to insert new price at %s: %w", item.Time, err)
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
		var time string
		var price float64
		if err := rows.Scan(&time, &price); err != nil {
			return nil, err
		}
		prices[time] = price
	}
	return prices, rows.Err()
}