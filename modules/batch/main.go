package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	if os.Getenv("CLOUD_RUN") == "1" {
		startHTTPServer()
		return
	}
	cmd := os.Getenv("CRAWLER_COMMAND")
	if cmd != "" {
		runSingleCommand(cmd)
		return
	}
	cliMode()
}

func startHTTPServer() {
	fmt.Println("CLOUD_RUN mode: starting HTTP server...")

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var reqBody struct {
			Command string `json:"command"`
		}
		if r.Body != nil {
			json.NewDecoder(r.Body).Decode(&reqBody)
		}
		if reqBody.Command == "" {
			reqBody.Command = "booking"
		}

		log.Printf("triggering cloud run job with command: %s", reqBody.Command)

		token, err := getDefaultToken()
		if err != nil {
			log.Printf("failed to get token: %v", err)
			http.Error(w, "auth error", http.StatusInternalServerError)
			return
		}

		override := fmt.Sprintf(`{"overrides":{"containerOverrides":[{"clearArgs":false,"env":[{"name":"CRAWLER_COMMAND","value":"%s"}]}]}}`, reqBody.Command)
		req, err := http.NewRequest("POST",
			fmt.Sprintf("https://%s-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/%s/jobs/%s:run?alt=json",
				"asia-southeast1", "padelitics-api", "courtside-crawler-job"),
			strings.NewReader(override))
		if err != nil {
			log.Printf("failed to create request: %v", err)
			http.Error(w, "request error", http.StatusInternalServerError)
			return
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("failed to trigger job: %v", err)
			http.Error(w, "trigger error", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			log.Printf("job trigger failed (%d): %s", resp.StatusCode, string(body))
			http.Error(w, "trigger failed", http.StatusInternalServerError)
			return
		}

		log.Println("job triggered successfully")
		w.WriteHeader(http.StatusAccepted)
		fmt.Fprintln(w, fmt.Sprintf(`{"status":"accepted","command":"%s"}`, reqBody.Command))
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	fmt.Printf("Listening on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func getDefaultToken() (string, error) {
	metadataURL := "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
	req, err := http.NewRequest("GET", metadataURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Metadata-Flavor", "Google")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", err
	}
	return tokenResp.AccessToken, nil
}

func runSingleCommand(cmd string) {
	if cmd == "" {
		cmd = "booking"
	}
	runCommand(cmd)
}

func runCommand(cmd string) {
	cfg, err := loadConfig("config.properties")
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	loginResp, err := login(cfg.Email, cfg.Password)
	if err != nil {
		log.Fatalf("login failed: %v", err)
	}
	log.Println("login successful")

	db, err := openDB(cfg)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer db.Close()

	switch cmd {
	case "booking":
		runCourtsCrawl(loginResp.AccessToken, db, time.Now(), cfg.Locations)
	case "booking partial":
		runBookingCrawlPartial(loginResp.AccessToken, db, cfg.Clubs, time.Now())
	case "court_price":
		runCourtPriceCrawlAll(loginResp.AccessToken, db, cfg.Locations)
	case "club":
		runClubCrawlAll(loginResp.AccessToken, db, cfg.Locations)
	case "location":
		runLocationCrawl(loginResp.AccessToken, db)
	default:
		runFullCrawl(loginResp.AccessToken, db, cfg)
	}
}

func runFullCrawl(token string, db *sql.DB, cfg *Config) {
	fmt.Println("fetching locations...")

	locations, err := fetchLocations(token)
	if err != nil {
		log.Fatalf("fetch locations failed: %v", err)
	}
	fmt.Printf("fetched %d locations\n", len(locations))

	if _, err := saveLocations(locations); err != nil {
		log.Fatalf("save locations failed: %v", err)
	}

	if err := syncLocations(db, locations); err != nil {
		log.Fatalf("sync locations to db failed: %v", err)
	}
	fmt.Printf("synced %d locations to database\n", len(locations))

	southJakartaID := "9eabec1b-e9c9-4f67-b9f5-f99c063a1a35"
	fmt.Println("fetching clubs for South Jakarta...")

	clubs, err := fetchClubs(token, southJakartaID)
	if err != nil {
		log.Fatalf("fetch clubs failed: %v", err)
	}
	fmt.Printf("fetched %d clubs\n", len(clubs))

	if err := syncClubs(db, clubs, southJakartaID); err != nil {
		log.Fatalf("sync clubs to db failed: %v", err)
	}
	fmt.Printf("synced %d clubs to database\n", len(clubs))

	runCourtsCrawl(token, db, time.Now(), cfg.Locations)
}

func cliMode() {
	cfg, err := loadConfig("config.properties")
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	if len(os.Args) > 1 && os.Args[1] == "setup" {
		if err := dbSetup(cfg); err != nil {
			log.Fatalf("db setup failed: %v", err)
		}
		return
	}

	loginResp, err := login(cfg.Email, cfg.Password)
	if err != nil {
		log.Fatalf("login failed: %v", err)
	}
	fmt.Println("login successful")

	db, err := openDB(cfg)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer db.Close()

	if len(os.Args) > 1 && os.Args[1] == "courts" {
		runCourtsCrawl(loginResp.AccessToken, db, time.Now(), cfg.Locations)
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "location" {
		runLocationCrawl(loginResp.AccessToken, db)
		return
	}

	if len(os.Args) > 2 && os.Args[1] == "club" {
		runClubCrawl(loginResp.AccessToken, db, os.Args[2])
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "club" {
		runClubCrawlAll(loginResp.AccessToken, db, cfg.Locations)
		return
	}

	if len(os.Args) > 5 && os.Args[1] == "booking" && os.Args[2] == "period" {
		start, err := time.Parse("02-01-2006", os.Args[4])
		if err != nil {
			log.Fatalf("invalid start date, use dd-mm-yyyy: %v", err)
		}
		end, err := time.Parse("02-01-2006", os.Args[5])
		if err != nil {
			log.Fatalf("invalid end date, use dd-mm-yyyy: %v", err)
		}
		jobStart := time.Now()
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			log.Printf("booking crawl for %s club %s", d.Format("2006-01-02"), os.Args[3])
			runBookingCrawl(loginResp.AccessToken, db, os.Args[3], d)
		}
		log.Printf("overall duration %s", formatDuration(time.Since(jobStart)))
		return
	}

	if len(os.Args) > 4 && os.Args[1] == "booking" && os.Args[2] == "period" {
		start, err := time.Parse("02-01-2006", os.Args[3])
		if err != nil {
			log.Fatalf("invalid start date, use dd-mm-yyyy: %v", err)
		}
		end, err := time.Parse("02-01-2006", os.Args[4])
		if err != nil {
			log.Fatalf("invalid end date, use dd-mm-yyyy: %v", err)
		}
		jobStart := time.Now()
		for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
			log.Printf("booking crawl for %s all clubs", d.Format("2006-01-02"))
			runCourtsCrawl(loginResp.AccessToken, db, d, cfg.Locations)
		}
		log.Printf("overall duration %s", formatDuration(time.Since(jobStart)))
		return
	}

	if len(os.Args) > 4 && os.Args[1] == "booking" && os.Args[2] == "date" {
		today, err := time.Parse("02-01-2006", os.Args[4])
		if err != nil {
			log.Fatalf("invalid date format, use dd-mm-yyyy: %v", err)
		}
		runBookingCrawl(loginResp.AccessToken, db, os.Args[3], today)
		return
	}

	if len(os.Args) > 3 && os.Args[1] == "booking" && os.Args[2] == "date" {
		today, err := time.Parse("02-01-2006", os.Args[3])
		if err != nil {
			log.Fatalf("invalid date format, use dd-mm-yyyy: %v", err)
		}
		runCourtsCrawl(loginResp.AccessToken, db, today, cfg.Locations)
		return
	}

	if len(os.Args) > 2 && os.Args[1] == "booking" && os.Args[2] == "partial" {
		runBookingCrawlPartial(loginResp.AccessToken, db, cfg.Clubs, time.Now())
		return
	}

	if len(os.Args) > 2 && os.Args[1] == "booking" {
		runBookingCrawl(loginResp.AccessToken, db, os.Args[2], time.Now())
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "booking" {
		runCourtsCrawl(loginResp.AccessToken, db, time.Now(), cfg.Locations)
		return
	}

	if len(os.Args) > 2 && os.Args[1] == "court_price" {
		runCourtPriceCrawl(loginResp.AccessToken, db, os.Args[2])
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "court_price" {
		runCourtPriceCrawlAll(loginResp.AccessToken, db, cfg.Locations)
		return
	}

	runFullCrawl(loginResp.AccessToken, db, cfg)
}