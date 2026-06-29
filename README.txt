# Courtside Crawler - Padel Court Booking Sync

Automated crawler that syncs club, court, and booking data from the Courtside.id API to a PostgreSQL database. Designed to run on Google Cloud Platform (GCP) with Cloud Run Jobs and Cloud Scheduler.

## Architecture

```
Cloud Scheduler (cron)
  → HTTP POST → Cloud Run Trigger Service
    → Google Cloud Run API
      → Cloud Run Job (courtside-crawler-job)
        → Crawls Courtside.id API → Syncs to PostgreSQL
```

## GCP Resources

| Resource | Name | Purpose |
|----------|------|---------|
| Cloud Run Job | `courtside-crawler-job` | Runs the crawl independently |
| Cloud Run Service | `courtside-crawler-trigger` | HTTP endpoint that triggers the Job |
| Cloud Scheduler | `courtside-crawler-daily` | Daily 05:30 WIB trigger |
| Secret Manager | `courtside-config` | Stores all credentials as JSON |
| Service Account | `courtside-crawler-sa` | IAM for Job + trigger |
| Artifact Registry | `gcr.io/padelitics-api/courtside-crawler` | Container image |

## Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `booking` | Full crawl: locations → clubs → courts → bookings | Daily sync |
| `booking partial` | Booking crawl for clubs in `CLUBS` config only | Hourly/daily partial |
| `court_price` | 7-day price crawl for all clubs | Periodic price update |
| `club` | Sync clubs for all locations | As needed |
| `location` | Sync locations | As needed |

## Local Development

### Prerequisites
- Go 1.26+
- PostgreSQL database
- Configured `config.properties` (see `config-dev.properties` for template)

### Build
```powershell
cd modules/batch
go build -o crawler.exe .
```

### Run Locally
```powershell
./crawler                  # Full crawl (default: booking)
./crawler booking          # Full booking crawl
./crawler booking partial  # Partial booking crawl (CLUBS only)
./crawler court_price      # Price crawl
./crawler club             # Club sync
./crawler location         # Location sync
./crawler setup            # Run database migrations (db/base/*.sql)
```

### Configuration
- `config.properties` — local dev credentials (gitignored)
- `config-prd.properties` — production locations/clubs (no secrets)
- `config-dev.properties` — full dev config with credentials

Secrets are loaded in priority order:
1. Secret Manager JSON file (mounted at `/secrets/config.json` in Cloud Run)
2. Environment variables (`DB_HOST`, `DB_PASSWORD`, etc.)
3. `config.properties` file

## Deployment

### Initial Setup
1. Enable APIs:
   ```bash
   gcloud services enable secretmanager.googleapis.com run.googleapis.com cloudscheduler.googleapis.com artifactregistry.googleapis.com
   ```
2. Create secret:
   ```bash
   gcloud secrets create courtside-config --data-file=config-dev.properties --replication-policy=automatic
   ```
3. Run `.\deploy.bat` from `modules/batch/`

### Manual Deploy
```powershell
cd modules/batch
.\deploy.bat
```

### Manual Trigger
```powershell
.\cloud_run.bat                                    # Full booking crawl
.\cloud_run_booking_partial.bat                    # Partial booking crawl
```

Or via gcloud:
```bash
gcloud run jobs execute courtside-crawler-job --region=asia-southeast1 --project=padelitics-api
```

## API Sources

- **Clubs/Locations**: `https://api.courtside.id/api/mobile/mitra/nearby-all-new`
- **Courts**: `https://api.courtside.id/api/mobile/booking-court/{clubID}/list-court-available`
- **Bookings**: Derived from court availability (unavailable slots = booked)
- **Prices**: `https://api.courtside.id/api/mobile/booking-court/{clubID}/list-book-time`

## Database Schema

Migrations are in `db/base/*.sql`, executed via `./crawler setup`.

Key tables:
- `clubs` — club data with operating hours
- `courts` — court data per club
- `bookings` — derived booking slots (date, time, court_id, price)
- `prices` — historical price tracking with period ranges
- `locations` — geographic locations

## Project Structure

```
modules/batch/
├── main.go                    # Entry point (CLI + HTTP server)
├── config.go                  # Config loading (properties + env + secret)
├── http.go                    # HTTP client with retry logic
├── authentication.go          # Login to Courtside API
├── location.go                # Location sync
├── club.go                    # Club sync
├── court.go                   # Court sync (unused directly)
├── courts_crawler.go          # Booking crawl (full + partial)
├── court_price_crawler.go     # Price crawl (7-day)
├── setup.go                   # Database migration runner
├── deploy.bat                 # GCP deployment script
├── cloud_run.bat              # Manual trigger (full crawl)
├── cloud_run_booking_partial.bat  # Manual trigger (partial)
├── Dockerfile                 # Container build
├── go.mod / go.sum
├── config.properties          # Local dev config (gitignored)
├── config-prd.properties      # Production locations/clubs
├── config-dev.properties      # Full dev config
└── reference/
    └── club.txt               # Sample API response
```

## Cost Estimate (Free Tier)

| Service | Free Quota | Expected Usage |
|---------|-----------|----------------|
| Cloud Run Job | 360,000 GB-seconds/month | ~10 GB-minutes/day |
| Cloud Scheduler | 3 jobs | 3 jobs (free tier) |
| Secret Manager | 6 secret versions | 1 secret |
| Artifact Registry | 0.5 GB storage | ~10 MB |
| Cloud Run Trigger | 2M requests/month | ~30 requests/month |

**Total: $0/month** (well within free tier)

## Schedules

| Job | Schedule (WIB) | Command |
|-----|----------------|---------|
| `courtside-crawler-0530` | Daily 05:30 | `booking` (full) |
| `courtside-crawler-1500` | Daily 15:00 | `booking` (full) |
| `courtside-crawler-court-price-weekly` | Monday 00:00 | `court_price` |

## Concurrency

All crawl commands use 5 concurrent workers with no sleep between clubs. A full 189-club booking crawl completes in ~2-3 minutes.

## Troubleshooting

`clubs.opening_date` is set using:
1. `start_date` from the API response (if not null/empty)
2. Fallback: `MIN(created_at)` from the `mitra_operating_hours` array

- **TLS timeout on login**: Transient network issue. The HTTP client retries 3 times with backoff.
- **Cloud Run Job timeout**: Job has 60-minute task timeout. Full crawl takes ~2-3 minutes with 5 workers.
- **Scheduler 30-min deadline**: Not an issue — trigger service returns immediately, Job runs independently.
- **Check logs**: Cloud Console → Cloud Run → Job → Logs
