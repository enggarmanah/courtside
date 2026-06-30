package dashboard

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"padel-api/config"
	"padel-api/externalapi"
	"padel-api/graph/model"
	"padel-api/utils"
	"sort"
	"strings"
	"time"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func parseAndNormalizeTime(s string, addDay bool) string {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		return s
	}
	t = t.In(utils.TimeZoneAsiaJakarta)
	if addDay {
		t = t.Add(24 * time.Hour)
	}
	return t.Format("2006-01-02 15:04:05")
}

func (s *Service) GetDashboardSummary(ctx context.Context, input model.DashboardSummaryInput) (*model.DashboardSummary, error) {
	clubFilter := &model.AnalyticsFilter{
		LocationID:    input.LocationID,
		MinCourtCount: input.MinCourtCount,
		MaxCourtCount: input.MaxCourtCount,
		MinPrice:      input.MinPrice,
		MaxPrice:      input.MaxPrice,
	}

	clubClauses, clubArgs, _ := s.buildClubFilterClauses(clubFilter, 1)
	clubWhere := ""
	if len(clubClauses) > 0 {
		clubWhere = " WHERE " + strings.Join(clubClauses, " AND ")
	}

	clubQuery := fmt.Sprintf("SELECT COUNT(*) FROM clubs c%s", clubWhere)
	utils.LogSQLWithContext("Dashboard Summary - Total Clubs", clubQuery, clubArgs...)
	var totalClubs int
	err := s.db.QueryRowContext(ctx, clubQuery, clubArgs...).Scan(&totalClubs)
	if err != nil {
		utils.LogSQLError(err, clubQuery, clubArgs...)
		return nil, err
	}

	whereClauses := []string{}
	var bookingArgs []interface{}
	argIdx := 1

	if input.From != nil && *input.From != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("b.booking_time >= $%d", argIdx))
		bookingArgs = append(bookingArgs, parseAndNormalizeTime(*input.From, false))
		argIdx++
	}
	if input.To != nil && *input.To != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("b.booking_time < $%d", argIdx))
		bookingArgs = append(bookingArgs, parseAndNormalizeTime(*input.To, true))
		argIdx++
	}

	bookingClubClauses, bookingClubArgs, _ := s.buildClubFilterClauses(clubFilter, argIdx)
	whereClauses = append(whereClauses, bookingClubClauses...)
	bookingArgs = append(bookingArgs, bookingClubArgs...)

	whereStr := ""
	if len(whereClauses) > 0 {
		whereStr = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	bookingCountQuery := "SELECT COUNT(*) FROM bookings b JOIN clubs c ON b.club_id = c.id" + whereStr
	utils.LogSQLWithContext("Dashboard Summary - Total Bookings", bookingCountQuery, bookingArgs...)
	var totalBookings int
	err = s.db.QueryRowContext(ctx, bookingCountQuery, bookingArgs...).Scan(&totalBookings)
	if err != nil {
		utils.LogSQLError(err, bookingCountQuery, bookingArgs...)
		return nil, err
	}

	revenueQuery := "SELECT COALESCE(SUM(b.price), 0) FROM bookings b JOIN clubs c ON b.club_id = c.id" + whereStr
	utils.LogSQLWithContext("Dashboard Summary - Total Revenue", revenueQuery, bookingArgs...)
	var totalRevenue float64
	err = s.db.QueryRowContext(ctx, revenueQuery, bookingArgs...).Scan(&totalRevenue)
	if err != nil {
		utils.LogSQLError(err, revenueQuery, bookingArgs...)
		return nil, err
	}

	var lastUpdatedAt sql.NullTime
	lastUpdateQuery := "SELECT MAX(b.updated_at) FROM bookings b JOIN clubs c ON b.club_id = c.id"
	var lastUpdateArgs []interface{}
	if input.LocationID != nil && *input.LocationID != "" {
		lastUpdateQuery += " WHERE c.location_id = $1"
		lastUpdateArgs = append(lastUpdateArgs, *input.LocationID)
	}
	utils.LogSQLWithContext("Dashboard Summary - Last Update", lastUpdateQuery, lastUpdateArgs...)
	err = s.db.QueryRowContext(ctx, lastUpdateQuery, lastUpdateArgs...).Scan(&lastUpdatedAt)
	if err != nil {
		utils.LogSQLError(err, lastUpdateQuery, lastUpdateArgs...)
		return nil, err
	}

	var lastUpdatedStr *string
	if lastUpdatedAt.Valid {
		localTime := utils.ForceJakartaTimeZone(lastUpdatedAt.Time)
		str := localTime.Format(time.RFC3339)
		lastUpdatedStr = &str
	}

	return &model.DashboardSummary{
		TotalClubs:    totalClubs,
		TotalBookings: totalBookings,
		TotalRevenue:  totalRevenue,
		LastUpdatedAt: lastUpdatedStr,
	}, nil
}

func (s *Service) GetClubOverview(ctx context.Context, input model.ClubOverviewInput) (*model.ClubOverviewResult, error) {
	var args []interface{}
	argIdx := 1

	joinClauses := []string{}
	if input.From != nil && *input.From != "" {
		joinClauses = append(joinClauses, fmt.Sprintf("b.booking_time >= $%d", argIdx))
		args = append(args, parseAndNormalizeTime(*input.From, false))
		argIdx++
	}
	if input.To != nil && *input.To != "" {
		joinClauses = append(joinClauses, fmt.Sprintf("b.booking_time < $%d", argIdx))
		args = append(args, parseAndNormalizeTime(*input.To, true))
		argIdx++
	}

	fromClause := "clubs c LEFT JOIN bookings b ON b.club_id = c.id"
	if len(joinClauses) > 0 {
		fromClause += " AND " + strings.Join(joinClauses, " AND ")
	}

	var whereClauses []string
	clubFilter := &model.AnalyticsFilter{
		LocationID:    input.LocationID,
		MinCourtCount: input.MinCourtCount,
		MaxCourtCount: input.MaxCourtCount,
		MinPrice:      input.MinPrice,
		MaxPrice:      input.MaxPrice,
	}
	clubClauses, clubArgs, nextIdx := s.buildClubFilterClauses(clubFilter, argIdx)
	whereClauses = append(whereClauses, clubClauses...)
	args = append(args, clubArgs...)
	argIdx = nextIdx

	sortField := "booking_count"
	if input.SortField != nil && *input.SortField != "" {
		sortField = *input.SortField
	}
	sortOrder := "DESC"
	if input.SortOrder != nil && strings.ToUpper(*input.SortOrder) == "ASC" {
		sortOrder = "ASC"
	}

	offset := utils.CalculateOffset(input.Page, input.PageSize)

	selectClause := `c.id, c.name, c.sub_name, c.address, c.lat, c.lng, c.location_id, c.logo_path, c.price,
		COUNT(b.id) AS booking_count,
		COALESCE(SUM(b.price), 0) AS total_revenue`

	groupBy := "c.id, c.name, c.sub_name, c.address, c.lat, c.lng, c.location_id, c.logo_path, c.price"

	var queryBuilder strings.Builder
	queryBuilder.WriteString(fmt.Sprintf("SELECT %s FROM %s", selectClause, fromClause))
	if len(whereClauses) > 0 {
		queryBuilder.WriteString(" WHERE ")
		queryBuilder.WriteString(strings.Join(whereClauses, " AND "))
	}
	queryBuilder.WriteString(fmt.Sprintf(" GROUP BY %s", groupBy))
	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %s %s", sortField, sortOrder))
	countArgsCount := len(args)
	queryBuilder.WriteString(fmt.Sprintf(" LIMIT $%d", argIdx))
	args = append(args, input.PageSize)
	argIdx++
	if offset > 0 {
		queryBuilder.WriteString(fmt.Sprintf(" OFFSET $%d", argIdx))
		args = append(args, offset)
		argIdx++
	}

	dataQuery := queryBuilder.String()
	utils.LogSQLWithContext("Club Overview - Data", dataQuery, args...)
	rows, err := s.db.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		utils.LogSQLError(err, dataQuery, args...)
		return nil, err
	}
	defer rows.Close()

	var items []*model.ClubOverviewItem
	for rows.Next() {
		var item model.ClubOverviewItem
		err := rows.Scan(
			&item.ID, &item.Name, &item.SubName, &item.Address, &item.Lat, &item.Lng,
			&item.LocationID, &item.LogoPath, &item.Price, &item.BookingCount, &item.TotalRevenue,
		)
		if err != nil {
			utils.LogSQLError(err, dataQuery, args...)
			return nil, err
		}
		items = append(items, &item)
	}

	var countBuilder strings.Builder
	countBuilder.WriteString(fmt.Sprintf("SELECT COUNT(*) FROM (SELECT 1 FROM %s", fromClause))
	if len(whereClauses) > 0 {
		countBuilder.WriteString(" WHERE ")
		countBuilder.WriteString(strings.Join(whereClauses, " AND "))
	}
	countBuilder.WriteString(fmt.Sprintf(" GROUP BY %s) AS sub", groupBy))

	countQuery := countBuilder.String()
	countArgs := args[:countArgsCount]
	utils.LogSQLWithContext("Club Overview - Count", countQuery, countArgs...)
	var totalCount int
	err = s.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		utils.LogSQLError(err, countQuery, countArgs...)
		return nil, err
	}

	pagination := utils.BuildPaginatedResult(totalCount, input.Page, input.PageSize)

	return &model.ClubOverviewResult{
		Items:       items,
		TotalCount:  pagination.TotalCount,
		TotalPages:  pagination.TotalPages,
		HasNextPage: pagination.HasNextPage,
	}, nil
}

func (s *Service) GetLocations(ctx context.Context) ([]*model.Location, error) {
	query := `SELECT l.id, l.name 
FROM locations l 
WHERE EXISTS (
	SELECT 1 
	FROM clubs c 
	JOIN bookings b ON b.club_id = c.id 
	WHERE c.location_id = l.id
) 
ORDER BY l.name ASC`
	utils.LogSQLWithContext("Get Locations", query)
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		utils.LogSQLError(err, query)
		return nil, err
	}
	defer rows.Close()

	var locations []*model.Location
	for rows.Next() {
		var loc model.Location
		err := rows.Scan(&loc.ID, &loc.Name)
		if err != nil {
			utils.LogSQLError(err, query)
			return nil, err
		}
		locations = append(locations, &loc)
	}
	return locations, nil
}

func (s *Service) GetClubPerformanceAnalytics(ctx context.Context, input model.ClubPerformanceAnalyticsInput) (*model.ClubPerformanceResult, error) {
	fromTime, err := time.Parse(time.RFC3339, input.From)
	if err != nil {
		fromTime = time.Now().In(utils.TimeZoneAsiaJakarta)
	} else {
		fromTime = fromTime.In(utils.TimeZoneAsiaJakarta)
	}

	toTime, err := time.Parse(time.RFC3339, input.To)
	if err != nil {
		toTime = time.Now().In(utils.TimeZoneAsiaJakarta)
	} else {
		toTime = toTime.In(utils.TimeZoneAsiaJakarta)
	}

	priceMap, err := s.getClubPriceMap(ctx, input.ClubID)
	if err != nil {
		return nil, err
	}
	priceSlotCount := 0
	for _, row := range priceMap {
		priceSlotCount += len(row.Slots)
	}
	fmt.Printf("[PRICEMAP] clubID=%s returned: %d day rows, %d total slots\n", input.ClubID, len(priceMap), priceSlotCount)

	daysDiff := int(toTime.Sub(fromTime).Hours()/24) + 1
	if daysDiff <= 0 {
		daysDiff = 1
	}
	dayCounts := map[string]int{
		"Monday": 0, "Tuesday": 0, "Wednesday": 0, "Thursday": 0,
		"Friday": 0, "Saturday": 0, "Sunday": 0,
	}
	for d := fromTime; !d.After(toTime); d = d.AddDate(0, 0, 1) {
		dayCounts[d.Format("Monday")]++
	}

	timeSlots := []string{
		"06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
		"14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
	}

	var totalCourts int
	courtQuery := "SELECT COUNT(*) FROM courts WHERE club_id = $1"
	utils.LogSQLWithContext("Get Performance Analytics - Total Courts", courtQuery, input.ClubID)
	err = s.db.QueryRowContext(ctx, courtQuery, input.ClubID).Scan(&totalCourts)
	if err != nil {
		utils.LogSQLError(err, courtQuery, input.ClubID)
		return nil, err
	}

	fromStr := parseAndNormalizeTime(input.From, false)
	toStr := parseAndNormalizeTime(input.To, true)

	now := time.Now().In(utils.TimeZoneAsiaJakarta)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, utils.TimeZoneAsiaJakarta)
	if !toTime.Before(today) {
		syncFrom := fromTime
		if syncFrom.Before(today) {
			syncFrom = today
		}
		if err := s.syncFromExternalAPI(ctx, input.ClubID, syncFrom, toTime); err != nil {
			utils.LogSQLError(err, "syncFromExternalAPI", input.ClubID)
		}
	}

	var totalBookings int
	var totalRevenue float64
	metricsQuery := `
		SELECT COUNT(*), COALESCE(SUM(price), 0)
		FROM bookings
		WHERE club_id = $1 AND booking_time >= $2 AND booking_time < $3
	`
	utils.LogSQLWithContext("Get Performance Metrics", metricsQuery, input.ClubID, fromStr, toStr)
	err = s.db.QueryRowContext(ctx, metricsQuery, input.ClubID, fromStr, toStr).Scan(&totalBookings, &totalRevenue)
	if err != nil {
		utils.LogSQLError(err, metricsQuery, input.ClubID, fromStr, toStr)
		return nil, err
	}

	avgDailyBookings := float64(totalBookings) / float64(daysDiff)
	avgDailyRevenue := totalRevenue / float64(daysDiff)

	metrics := &model.ClubPerformanceMetrics{
		TotalBookings:    totalBookings,
		AvgDailyBookings: avgDailyBookings,
		TotalRevenue:     totalRevenue,
		AvgDailyRevenue:  avgDailyRevenue,
	}

	var chartQuery string
	if daysDiff == 1 {
		chartQuery = `
			SELECT 
				TO_CHAR(booking_time, 'HH24:00') AS label,
				COUNT(*)::float8 AS booking_count,
				COALESCE(SUM(price), 0)::float8 AS total_revenue
			FROM bookings
			WHERE club_id = $1 AND booking_time >= $2 AND booking_time < $3
			GROUP BY TO_CHAR(booking_time, 'HH24:00'), DATE_PART('hour', booking_time)
			ORDER BY DATE_PART('hour', booking_time)
		`
	} else if daysDiff <= utils.DailyGranularityMaxDays {
		chartQuery = `
			SELECT 
				TO_CHAR(booking_time, 'DD Mon') AS label,
				COUNT(*)::float8 AS booking_count,
				COALESCE(SUM(price), 0)::float8 AS total_revenue
			FROM bookings
			WHERE club_id = $1 AND booking_time >= $2 AND booking_time < $3
			GROUP BY TO_CHAR(booking_time, 'DD Mon'), DATE_TRUNC('day', booking_time)
			ORDER BY DATE_TRUNC('day', booking_time)
		`
	} else {
		chartQuery = `
			SELECT 
				TO_CHAR(booking_time, 'Mon YYYY') AS label,
				COUNT(*)::float8 AS booking_count,
				COALESCE(SUM(price), 0)::float8 AS total_revenue
			FROM bookings
			WHERE club_id = $1 AND booking_time >= $2 AND booking_time < $3
			GROUP BY TO_CHAR(booking_time, 'Mon YYYY'), DATE_TRUNC('month', booking_time)
			ORDER BY DATE_TRUNC('month', booking_time)
		`
	}

	utils.LogSQLWithContext("Get Performance Charts", chartQuery, input.ClubID, fromStr, toStr)
	rows, err := s.db.QueryContext(ctx, chartQuery, input.ClubID, fromStr, toStr)
	if err != nil {
		utils.LogSQLError(err, chartQuery, input.ClubID, fromStr, toStr)
		return nil, err
	}
	defer rows.Close()

	var bookingChart []*model.ClubPerformanceChartItem
	var revenueChart []*model.ClubPerformanceChartItem

	dbBookings := make(map[string]float64)
	dbRevenue := make(map[string]float64)

	for rows.Next() {
		var label string
		var bookingsVal float64
		var revenueVal float64
		if err := rows.Scan(&label, &bookingsVal, &revenueVal); err != nil {
			return nil, err
		}
		if daysDiff == 1 {
			dbBookings[label] = bookingsVal
			dbRevenue[label] = revenueVal
		} else {
			bookingChart = append(bookingChart, &model.ClubPerformanceChartItem{
				Label: label,
				Value: bookingsVal,
			})
			revenueChart = append(revenueChart, &model.ClubPerformanceChartItem{
				Label: label,
				Value: revenueVal,
			})
		}
	}

	if daysDiff == 1 {
		for _, slot := range timeSlots {
			bookingChart = append(bookingChart, &model.ClubPerformanceChartItem{
				Label: slot,
				Value: dbBookings[slot],
			})
			revenueChart = append(revenueChart, &model.ClubPerformanceChartItem{
				Label: slot,
				Value: dbRevenue[slot],
			})
		}
	}

	occupancyQuery := `
		SELECT 
			TRIM(TO_CHAR(booking_time, 'Day')) AS day_of_week, 
			TO_CHAR(booking_time, 'HH24:00') AS time_slot,
			COUNT(*) AS booking_count
		FROM bookings
		WHERE club_id = $1 AND booking_time >= $2 AND booking_time < $3
		GROUP BY TRIM(TO_CHAR(booking_time, 'Day')), TO_CHAR(booking_time, 'HH24:00')
	`
	utils.LogSQLWithContext("Get Performance Occupancy", occupancyQuery, input.ClubID, fromStr, toStr)
	occRows, err := s.db.QueryContext(ctx, occupancyQuery, input.ClubID, fromStr, toStr)
	if err != nil {
		utils.LogSQLError(err, occupancyQuery, input.ClubID, fromStr, toStr)
		return nil, err
	}
	defer occRows.Close()

	bookingsMap := make(map[string]int)
	for occRows.Next() {
		var dayName string
		var timeSlot string
		var count int
		if err := occRows.Scan(&dayName, &timeSlot, &count); err != nil {
			return nil, err
		}
		bookingsMap[dayName+":"+timeSlot] = count
	}

	days := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

	var occupancyHeatmap []*model.ClubOccupancyDayRow
	for _, day := range days {
		var slots []*model.ClubOccupancySlot
		occurrences := dayCounts[day]
		for _, slot := range timeSlots {
			count := bookingsMap[day+":"+slot]
			rate := 0.0
			if totalCourts > 0 && occurrences > 0 {
				rate = (float64(count) / float64(totalCourts*occurrences)) * 100.0
			}
			slots = append(slots, &model.ClubOccupancySlot{
				Time:          slot,
				OccupancyRate: rate,
			})
		}
		occupancyHeatmap = append(occupancyHeatmap, &model.ClubOccupancyDayRow{
			Day:   day,
			Slots: slots,
		})
	}

nonZero := 0
	for _, row := range priceMap {
		for _, s := range row.Slots {
			if s.Price > 0 {
				nonZero++
			}
		}
	}
	fmt.Printf("[PRICEMAP] FINAL RESPONSE: clubID=%s priceMap has %d day rows, %d slots with price > 0\n", input.ClubID, len(priceMap), nonZero)

	return &model.ClubPerformanceResult{
		Metrics:          metrics,
		BookingChart:     bookingChart,
		RevenueChart:     revenueChart,
		OccupancyHeatmap: occupancyHeatmap,
		PriceMap:         priceMap,
	}, nil
}

func (s *Service) getClubPriceMap(ctx context.Context, clubID string) ([]*model.ClubPriceDayRow, error) {
	timeSlots := []string{
		"06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
		"14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
	}
	dayNames := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

	query := `
		SELECT day, time, price
		FROM prices
		WHERE club_id = $1
		  AND start_period <= NOW()
		  AND (end_period IS NULL OR end_period > NOW())
		ORDER BY day, time, start_period DESC
	`
	utils.LogSQLWithContext("[PRICEMAP] SQL", query, clubID)

	rows, err := s.db.QueryContext(ctx, query, clubID)
	if err != nil {
		utils.LogSQLError(err, "[PRICEMAP] query failed", clubID)
		return nil, err
	}
	defer rows.Close()

	bestPrice := map[string]map[string]float64{}
	rowCount := 0
	for rows.Next() {
		rowCount++
		var day, ts string
		var price float64
		if err := rows.Scan(&day, &ts, &price); err != nil {
			fmt.Printf("[PRICEMAP] scan error at row %d: %v\n", rowCount, err)
			return nil, err
		}
		norm := strings.ToUpper(strings.TrimSpace(day))
		fullDay := map[string]string{
			"MON": "Monday", "TUE": "Tuesday", "WED": "Wednesday",
			"THU": "Thursday", "FRI": "Friday", "SAT": "Saturday", "SUN": "Sunday",
		}[norm]
		if fullDay == "" {
			continue
		}
		normalizedTime := strings.ReplaceAll(ts, ".", ":")
		if strings.HasSuffix(normalizedTime, ":30") {
			normalizedTime = strings.TrimSuffix(normalizedTime, ":30") + ":00"
		}
		if _, ok := bestPrice[fullDay]; !ok {
			bestPrice[fullDay] = map[string]float64{}
		}
		if _, exists := bestPrice[fullDay][normalizedTime]; !exists {
			bestPrice[fullDay][normalizedTime] = price
		}
		fmt.Printf("[PRICEMAP] row %d: raw_day=%q time=%q norm=%q price=%f\n", rowCount, day, normalizedTime, norm, price)
	}
	if err := rows.Err(); err != nil {
		fmt.Printf("[PRICEMAP] rows.Err after loop: %v\n", err)
		return nil, err
	}
	fmt.Printf("[PRICEMAP] total rows scanned: %d\n", rowCount)
	fmt.Printf("[PRICEMAP] bestPrice map keys: ")
	for k, v := range bestPrice {
		fmt.Printf("%s=%d_slots ", k, len(v))
	}
	fmt.Println()

	result := []*model.ClubPriceDayRow{}
	for _, day := range dayNames {
		slots := []*model.ClubPriceSlot{}
		for _, ts := range timeSlots {
			price := bestPrice[day][ts]
			if price > 0 {
				fmt.Printf("[PRICEMAP] result cell: %s @ %s = %f\n", day, ts, price)
			}
			slots = append(slots, &model.ClubPriceSlot{
				Time:  ts,
				Price: price,
			})
		}
		result = append(result, &model.ClubPriceDayRow{
			Day:   day,
			Slots: slots,
		})
	}
	fmt.Printf("[PRICEMAP] result: %d day rows returned\n", len(result))
	return result, nil
}

func (s *Service) syncFromExternalAPI(ctx context.Context, clubID string, fromDate, toDate time.Time) error {
	var name string
	var hoursJSON json.RawMessage
	if err := s.db.QueryRowContext(ctx, "SELECT name, opening_hours FROM clubs WHERE id = $1", clubID).Scan(&name, &hoursJSON); err != nil {
		return fmt.Errorf("failed to load club %s: %w", clubID, err)
	}

	cfg := config.GetConfig()
	client := externalapi.NewCourtsideClient(cfg.CourtsideEmail, cfg.CourtsidePassword)
	return client.SyncDateRange(ctx, s.db, clubID, name, fromDate, toDate, hoursJSON)
}

// buildClubFilterClauses constructs WHERE clauses for club-level filters.
func getSortKey(bucket string) int {
	if bucket == "Unknown" {
		return 999
	}
	if strings.Contains(bucket, "+") {
		return 6
	}
	parts := strings.Split(bucket, " ")
	if len(parts) > 0 {
		n, err := fmt.Sscanf(parts[0], "%d", new(int))
		if err == nil && n == 1 {
			var v int
			fmt.Sscanf(parts[0], "%d", &v)
			return v
		}
	}
	return 999
}

func (s *Service) buildClubFilterClauses(input *model.AnalyticsFilter, startArgIdx int) ([]string, []interface{}, int) {
	var clauses []string
	var args []interface{}
	argIdx := startArgIdx

	if input.LocationID != nil && *input.LocationID != "" {
		clauses = append(clauses, fmt.Sprintf("c.location_id = $%d", argIdx))
		args = append(args, *input.LocationID)
		argIdx++
	}
	if input.MinCourtCount != nil {
		clauses = append(clauses, fmt.Sprintf("(SELECT COUNT(*) FROM courts WHERE courts.club_id = c.id) >= $%d", argIdx))
		args = append(args, *input.MinCourtCount)
		argIdx++
	}
	if input.MaxCourtCount != nil {
		clauses = append(clauses, fmt.Sprintf("(SELECT COUNT(*) FROM courts WHERE courts.club_id = c.id) <= $%d", argIdx))
		args = append(args, *input.MaxCourtCount)
		argIdx++
	}
	if input.MinPrice != nil {
		clauses = append(clauses, fmt.Sprintf("c.price >= $%d", argIdx))
		args = append(args, *input.MinPrice)
		argIdx++
	}
	if input.MaxPrice != nil {
		clauses = append(clauses, fmt.Sprintf("c.price <= $%d", argIdx))
		args = append(args, *input.MaxPrice)
		argIdx++
	}

	return clauses, args, argIdx
}

func (s *Service) buildBookingTimeFilterClauses(input *model.AnalyticsFilter, startArgIdx int) ([]string, []interface{}, int) {
	var clauses []string
	var args []interface{}
	argIdx := startArgIdx

	if input.From != nil && *input.From != "" {
		clauses = append(clauses, fmt.Sprintf("b.booking_time >= $%d", argIdx))
		args = append(args, parseAndNormalizeTime(*input.From, false))
		argIdx++
	}
	if input.To != nil && *input.To != "" {
		clauses = append(clauses, fmt.Sprintf("b.booking_time < $%d", argIdx))
		args = append(args, parseAndNormalizeTime(*input.To, true))
		argIdx++
	}

	return clauses, args, argIdx
}

func determineGranularity(from, to time.Time) (string, int) {
	return utils.DetermineGranularity(from, to)
}

func granularityLabelFormat(granularity string) string {
	return utils.GranularityLabelFormat(granularity)
}

func granularityTrunc(granularity string) string {
	return utils.GranularityTrunc(granularity)
}

func (s *Service) GetAnalyticsSummary(ctx context.Context, input *model.AnalyticsFilter) (*model.DashboardSummary, error) {
	var totalClubs int
	clubQuery := "SELECT COUNT(*) FROM clubs c"
	clubArgs := []interface{}{}
	argIdx := 1

	clubClauses, clubFilterArgs, nextIdx := s.buildClubFilterClauses(input, argIdx)
	if len(clubClauses) > 0 {
		clubQuery += " WHERE " + strings.Join(clubClauses, " AND ")
		clubArgs = append(clubArgs, clubFilterArgs...)
	}
	argIdx = nextIdx

	utils.LogSQLWithContext("Analytics Summary - Total Clubs", clubQuery, clubArgs...)
	err := s.db.QueryRowContext(ctx, clubQuery, clubArgs...).Scan(&totalClubs)
	if err != nil {
		utils.LogSQLError(err, clubQuery, clubArgs...)
		return nil, err
	}

	whereClauses := []string{}
	var bookingArgs []interface{}
	bookingClauses, bookingFilterArgs, nextIdx := s.buildBookingTimeFilterClauses(input, 1)
	whereClauses = append(whereClauses, bookingClauses...)
	bookingArgs = append(bookingArgs, bookingFilterArgs...)

	clubClauses2, clubFilterArgs2, _ := s.buildClubFilterClauses(input, nextIdx)
	whereClauses = append(whereClauses, clubClauses2...)
	bookingArgs = append(bookingArgs, clubFilterArgs2...)

	whereStr := ""
	if len(whereClauses) > 0 {
		whereStr = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	bookingCountQuery := "SELECT COUNT(*) FROM bookings b JOIN clubs c ON b.club_id = c.id" + whereStr
	utils.LogSQLWithContext("Analytics Summary - Total Bookings", bookingCountQuery, bookingArgs...)
	var totalBookings int
	err = s.db.QueryRowContext(ctx, bookingCountQuery, bookingArgs...).Scan(&totalBookings)
	if err != nil {
		utils.LogSQLError(err, bookingCountQuery, bookingArgs...)
		return nil, err
	}

	revenueQuery := "SELECT COALESCE(SUM(b.price), 0) FROM bookings b JOIN clubs c ON b.club_id = c.id" + whereStr
	utils.LogSQLWithContext("Analytics Summary - Total Revenue", revenueQuery, bookingArgs...)
	var totalRevenue float64
	err = s.db.QueryRowContext(ctx, revenueQuery, bookingArgs...).Scan(&totalRevenue)
	if err != nil {
		utils.LogSQLError(err, revenueQuery, bookingArgs...)
		return nil, err
	}

	var lastUpdatedAt sql.NullTime
	lastUpdateQuery := "SELECT MAX(b.updated_at) FROM bookings b JOIN clubs c ON b.club_id = c.id"
	var lastUpdateArgs []interface{}
	if input.LocationID != nil && *input.LocationID != "" {
		lastUpdateQuery += " WHERE c.location_id = $1"
		lastUpdateArgs = append(lastUpdateArgs, *input.LocationID)
	}
	utils.LogSQLWithContext("Analytics Summary - Last Update", lastUpdateQuery, lastUpdateArgs...)
	err = s.db.QueryRowContext(ctx, lastUpdateQuery, lastUpdateArgs...).Scan(&lastUpdatedAt)
	if err != nil {
		utils.LogSQLError(err, lastUpdateQuery, lastUpdateArgs...)
		return nil, err
	}

	var lastUpdatedStr *string
	if lastUpdatedAt.Valid {
		localTime := utils.ForceJakartaTimeZone(lastUpdatedAt.Time)
		str := localTime.Format(time.RFC3339)
		lastUpdatedStr = &str
	}

	return &model.DashboardSummary{
		TotalClubs:    totalClubs,
		TotalBookings: totalBookings,
		TotalRevenue:  totalRevenue,
		LastUpdatedAt: lastUpdatedStr,
	}, nil
}

func (s *Service) GetBookingTrend(ctx context.Context, input *model.AnalyticsFilter) ([]*model.AnalyticsChartItem, error) {
	fromTime, err := time.Parse(time.RFC3339, *input.From)
	if err != nil || input.From == nil {
		fromTime = time.Now().In(utils.TimeZoneAsiaJakarta)
	} else {
		fromTime = fromTime.In(utils.TimeZoneAsiaJakarta)
	}

	toTime, err := time.Parse(time.RFC3339, *input.To)
	if err != nil || input.To == nil {
		toTime = time.Now().In(utils.TimeZoneAsiaJakarta)
	} else {
		toTime = toTime.In(utils.TimeZoneAsiaJakarta)
	}

	granularity, _ := determineGranularity(fromTime, toTime)
	labelFormat := granularityLabelFormat(granularity)
	truncFormat := granularityTrunc(granularity)

	whereClauses, args, argIdx := s.buildBookingTimeFilterClauses(input, 1)
	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, argIdx)
	whereClauses = append(whereClauses, clubClauses...)
	args = append(args, clubArgs...)

	whereStr := ""
	if len(whereClauses) > 0 {
		whereStr = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	var chartQuery string
	if granularity == "hourly" {
		chartQuery = fmt.Sprintf(`
			SELECT TO_CHAR(b.booking_time, '%s') AS label, COUNT(*)::float8 AS value
			FROM bookings b JOIN clubs c ON b.club_id = c.id%s
			GROUP BY TO_CHAR(b.booking_time, '%s'), DATE_PART('hour', b.booking_time)
			ORDER BY DATE_PART('hour', b.booking_time)
		`, labelFormat, whereStr, labelFormat)
	} else {
		chartQuery = fmt.Sprintf(`
			SELECT TO_CHAR(b.booking_time, '%s') AS label, COUNT(*)::float8 AS value
			FROM bookings b JOIN clubs c ON b.club_id = c.id%s
			GROUP BY TO_CHAR(b.booking_time, '%s'), DATE_TRUNC('%s', b.booking_time)
			ORDER BY DATE_TRUNC('%s', b.booking_time)
		`, labelFormat, whereStr, labelFormat, truncFormat, truncFormat)
	}

	utils.LogSQLWithContext("Get Booking Trend", chartQuery, args...)
	rows, err := s.db.QueryContext(ctx, chartQuery, args...)
	if err != nil {
		utils.LogSQLError(err, chartQuery, args...)
		return nil, err
	}
	defer rows.Close()

	var items []*model.AnalyticsChartItem
	if granularity == "hourly" {
		dbValues := make(map[string]float64)
		for rows.Next() {
			var label string
			var value float64
			if err := rows.Scan(&label, &value); err != nil {
				return nil, err
			}
			dbValues[label] = value
		}
		timeSlots := []string{
			"06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
			"14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
		}
		for _, slot := range timeSlots {
			items = append(items, &model.AnalyticsChartItem{Label: slot, Value: dbValues[slot]})
		}
	} else {
		for rows.Next() {
			var item model.AnalyticsChartItem
			if err := rows.Scan(&item.Label, &item.Value); err != nil {
				return nil, err
			}
			items = append(items, &item)
		}
	}

	return items, nil
}

func (s *Service) GetBookingsPerClub(ctx context.Context, input *model.AnalyticsFilter, topX int) ([]*model.AnalyticsMultiSeries, error) {
	if topX <= 0 {
		topX = 25
	}

	btClauses, btArgs, btArgIdx := s.buildBookingTimeFilterClauses(input, 1)
	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, btArgIdx)

	allWhereClauses := append([]string{}, btClauses...)
	allWhereClauses = append(allWhereClauses, clubClauses...)
	allArgs := append([]interface{}{}, btArgs...)
	allArgs = append(allArgs, clubArgs...)

	whereStr := ""
	if len(allWhereClauses) > 0 {
		whereStr = " WHERE " + strings.Join(allWhereClauses, " AND ")
	}

	topClubsQuery := fmt.Sprintf(`
		SELECT c.id, c.name, COUNT(*) AS total
		FROM bookings b JOIN clubs c ON b.club_id = c.id%s
		GROUP BY c.id, c.name
		ORDER BY total DESC
		LIMIT $%d
	`, whereStr, len(allArgs)+1)

	topClubsArgs := append([]interface{}{}, allArgs...)
	topClubsArgs = append(topClubsArgs, topX)

	utils.LogSQLWithContext("Get Bookings Per Club - Top Clubs", topClubsQuery, topClubsArgs...)
	topRows, err := s.db.QueryContext(ctx, topClubsQuery, topClubsArgs...)
	if err != nil {
		utils.LogSQLError(err, topClubsQuery, topClubsArgs...)
		return nil, err
	}
	defer topRows.Close()

	type topClub struct {
		id   string
		name string
	}
	var topClubs []topClub
	for topRows.Next() {
		var tc topClub
		var total int
		if err := topRows.Scan(&tc.id, &tc.name, &total); err != nil {
			return nil, err
		}
		topClubs = append(topClubs, tc)
	}

	if len(topClubs) == 0 {
		return nil, nil
	}

	fromTime, _ := time.Parse(time.RFC3339, *input.From)
	toTime, _ := time.Parse(time.RFC3339, *input.To)
	granularity, _ := determineGranularity(fromTime, toTime)
	labelFormat := granularityLabelFormat(granularity)
	truncFormat := granularityTrunc(granularity)

	resultMap := map[string]map[string]float64{}

	clubNameMap := map[string]string{}
	for _, tc := range topClubs {
		clubNameMap[tc.id] = tc.name
	}

	clubIdPlaceholders := make([]string, len(topClubs))
	for i := range topClubs {
		clubIdPlaceholders[i] = fmt.Sprintf("$%d", len(allArgs)+1+i)
	}
	clubIdArrayExpr := fmt.Sprintf("ARRAY[%s]::uuid[]", strings.Join(clubIdPlaceholders, ", "))

	singleQueryClauses := make([]string, len(allWhereClauses))
	copy(singleQueryClauses, allWhereClauses)
	singleQueryClauses = append(singleQueryClauses, "c.id = ANY("+clubIdArrayExpr+")")
	singleQueryWhereStr := " WHERE " + strings.Join(singleQueryClauses, " AND ")

	singleQuery := fmt.Sprintf(`
		SELECT TO_CHAR(b.booking_time, '%s') AS label, c.id, COUNT(*)::float8 AS value
		FROM bookings b JOIN clubs c ON b.club_id = c.id%s
		GROUP BY TO_CHAR(b.booking_time, '%s'), DATE_TRUNC('%s', b.booking_time), c.id
		ORDER BY DATE_TRUNC('%s', b.booking_time), c.id
	`, labelFormat, singleQueryWhereStr, labelFormat, truncFormat, truncFormat)

	totalArgs := len(allArgs) + len(topClubs)
	singleArgs := make([]interface{}, totalArgs)
	copy(singleArgs, allArgs)
	for i, tc := range topClubs {
		singleArgs[len(allArgs)+i] = tc.id
	}

	utils.LogSQLWithContext("Get Bookings Per Club - Single Query", singleQuery, singleArgs...)
	rows, err := s.db.QueryContext(ctx, singleQuery, singleArgs...)
	if err != nil {
		utils.LogSQLError(err, singleQuery, singleArgs...)
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var label, clubId string
		var value float64
		if err := rows.Scan(&label, &clubId, &value); err != nil {
			return nil, err
		}
		if resultMap[label] == nil {
			resultMap[label] = map[string]float64{}
		}
		resultMap[label][clubNameMap[clubId]] = value
	}

	var result []*model.AnalyticsMultiSeries
	for label, seriesMap := range resultMap {
		var series []*model.AnalyticsSeriesItem
		for _, tc := range topClubs {
			series = append(series, &model.AnalyticsSeriesItem{
				Name:  tc.name,
				Value: seriesMap[tc.name],
			})
		}
		result = append(result, &model.AnalyticsMultiSeries{Label: label, Series: series})
	}

	return result, nil
}

func (s *Service) GetClubGrowthByCity(ctx context.Context, input *model.AnalyticsFilter) ([]*model.AnalyticsMultiSeries, error) {
	fromTime, _ := time.Parse(time.RFC3339, *input.From)
	toTime, _ := time.Parse(time.RFC3339, *input.To)
	fromTime = fromTime.In(utils.TimeZoneAsiaJakarta)
	toTime = toTime.In(utils.TimeZoneAsiaJakarta)
	granularity, _ := determineGranularity(fromTime, toTime)
	labelFormat := granularityLabelFormat(granularity)
	truncFormat := granularityTrunc(granularity)

	type period struct {
		label string
		end   time.Time
	}
	var periods []period

	if granularity == "hourly" || granularity == "daily" {
		for d := fromTime; !d.After(toTime); d = d.AddDate(0, 0, 1) {
			periods = append(periods, period{label: d.Format("02 Jan"), end: d})
		}
	} else {
		for d := fromTime; !d.After(toTime); d = d.AddDate(0, 1, 0) {
			periods = append(periods, period{label: d.Format("Jan 2006"), end: d})
		}
	}

	if len(periods) == 0 {
		return nil, nil
	}

	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, 1)
	clubWhere := ""
	if len(clubClauses) > 0 {
		clubWhere = " AND " + strings.Join(clubClauses, " AND ")
	}

	fromStr := fromTime.Format("2006-01-02")
	toStr := toTime.Format("2006-01-02")

	baselineQuery := fmt.Sprintf(`
		SELECT l.name AS city, COUNT(c.id)::float8 AS value
		FROM clubs c
		JOIN locations l ON c.location_id = l.id
		WHERE c.opening_date IS NOT NULL AND c.opening_date < $1%s
		GROUP BY l.name
	`, clubWhere)

	baselineArgs := append([]interface{}{fromStr}, clubArgs...)
	utils.LogSQLWithContext("Get Club Growth By City - Baseline", baselineQuery, baselineArgs...)
	baselineRows, err := s.db.QueryContext(ctx, baselineQuery, baselineArgs...)
	if err != nil {
		utils.LogSQLError(err, baselineQuery, baselineArgs...)
		return nil, err
	}

	cumulative := map[string]float64{}
	for baselineRows.Next() {
		var city string
		var value float64
		if err := baselineRows.Scan(&city, &value); err != nil {
			baselineRows.Close()
			return nil, err
		}
		cumulative[city] = value
	}
	baselineRows.Close()

	incrementQuery := fmt.Sprintf(`
		SELECT l.name AS city,
			   TO_CHAR(DATE_TRUNC('%s', c.opening_date), '%s') AS period_label,
			   COUNT(c.id)::float8 AS delta
		FROM clubs c
		JOIN locations l ON c.location_id = l.id
		WHERE c.opening_date IS NOT NULL AND c.opening_date >= $1 AND c.opening_date <= $2%s
		GROUP BY l.name, DATE_TRUNC('%s', c.opening_date)
		ORDER BY DATE_TRUNC('%s', c.opening_date)
	`, truncFormat, labelFormat, clubWhere, truncFormat, truncFormat)

	incrementArgs := append([]interface{}{fromStr, toStr}, clubArgs...)
	utils.LogSQLWithContext("Get Club Growth By City - Increments", incrementQuery, incrementArgs...)
	incrRows, err := s.db.QueryContext(ctx, incrementQuery, incrementArgs...)
	if err != nil {
		utils.LogSQLError(err, incrementQuery, incrementArgs...)
		return nil, err
	}

	increments := map[string]map[string]float64{}
	for incrRows.Next() {
		var city, label string
		var delta float64
		if err := incrRows.Scan(&city, &label, &delta); err != nil {
			incrRows.Close()
			return nil, err
		}
		if increments[label] == nil {
			increments[label] = map[string]float64{}
		}
		increments[label][city] = delta
	}
	incrRows.Close()

	var result []*model.AnalyticsMultiSeries
	for _, p := range periods {
		if deltas, ok := increments[p.label]; ok {
			for city, delta := range deltas {
				cumulative[city] += delta
			}
		}

		var series []*model.AnalyticsSeriesItem
		for city, value := range cumulative {
			series = append(series, &model.AnalyticsSeriesItem{Name: city, Value: value})
		}
		sort.Slice(series, func(i, j int) bool {
			return series[i].Value > series[j].Value
		})

		result = append(result, &model.AnalyticsMultiSeries{Label: p.label, Series: series})
	}

	return result, nil
}

func (s *Service) GetCourtGrowthByCity(ctx context.Context, input *model.AnalyticsFilter) ([]*model.AnalyticsMultiSeries, error) {
	fromTime, _ := time.Parse(time.RFC3339, *input.From)
	toTime, _ := time.Parse(time.RFC3339, *input.To)
	fromTime = fromTime.In(utils.TimeZoneAsiaJakarta)
	toTime = toTime.In(utils.TimeZoneAsiaJakarta)
	granularity, _ := determineGranularity(fromTime, toTime)
	labelFormat := granularityLabelFormat(granularity)
	truncFormat := granularityTrunc(granularity)

	type period struct {
		label string
		end   time.Time
	}
	var periods []period

	if granularity == "hourly" || granularity == "daily" {
		for d := fromTime; !d.After(toTime); d = d.AddDate(0, 0, 1) {
			periods = append(periods, period{label: d.Format("02 Jan"), end: d})
		}
	} else {
		for d := fromTime; !d.After(toTime); d = d.AddDate(0, 1, 0) {
			periods = append(periods, period{label: d.Format("Jan 2006"), end: d})
		}
	}

	if len(periods) == 0 {
		return nil, nil
	}

	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, 1)
	clubWhere := ""
	if len(clubClauses) > 0 {
		clubWhere = " AND " + strings.Join(clubClauses, " AND ")
	}

	fromStr := fromTime.Format("2006-01-02")
	toStr := toTime.Format("2006-01-02")

	baselineQuery := fmt.Sprintf(`
		SELECT l.name AS city, COALESCE(SUM((SELECT COUNT(*) FROM courts WHERE courts.club_id = c.id)), 0)::float8 AS value
		FROM clubs c
		JOIN locations l ON c.location_id = l.id
		WHERE c.opening_date IS NOT NULL AND c.opening_date < $1%s
		GROUP BY l.name
	`, clubWhere)

	baselineArgs := append([]interface{}{fromStr}, clubArgs...)
	utils.LogSQLWithContext("Get Court Growth By City - Baseline", baselineQuery, baselineArgs...)
	baselineRows, err := s.db.QueryContext(ctx, baselineQuery, baselineArgs...)
	if err != nil {
		utils.LogSQLError(err, baselineQuery, baselineArgs...)
		return nil, err
	}

	cumulative := map[string]float64{}
	for baselineRows.Next() {
		var city string
		var value float64
		if err := baselineRows.Scan(&city, &value); err != nil {
			baselineRows.Close()
			return nil, err
		}
		cumulative[city] = value
	}
	baselineRows.Close()

	incrementQuery := fmt.Sprintf(`
		SELECT l.name AS city,
			   TO_CHAR(DATE_TRUNC('%s', c.opening_date), '%s') AS period_label,
			   COALESCE(SUM((SELECT COUNT(*) FROM courts WHERE courts.club_id = c.id)), 0)::float8 AS delta
		FROM clubs c
		JOIN locations l ON c.location_id = l.id
		WHERE c.opening_date IS NOT NULL AND c.opening_date >= $1 AND c.opening_date <= $2%s
		GROUP BY l.name, DATE_TRUNC('%s', c.opening_date)
		ORDER BY DATE_TRUNC('%s', c.opening_date)
	`, truncFormat, labelFormat, clubWhere, truncFormat, truncFormat)

	incrementArgs := append([]interface{}{fromStr, toStr}, clubArgs...)
	utils.LogSQLWithContext("Get Court Growth By City - Increments", incrementQuery, incrementArgs...)
	incrRows, err := s.db.QueryContext(ctx, incrementQuery, incrementArgs...)
	if err != nil {
		utils.LogSQLError(err, incrementQuery, incrementArgs...)
		return nil, err
	}

	increments := map[string]map[string]float64{}
	for incrRows.Next() {
		var city, label string
		var delta float64
		if err := incrRows.Scan(&city, &label, &delta); err != nil {
			incrRows.Close()
			return nil, err
		}
		if increments[label] == nil {
			increments[label] = map[string]float64{}
		}
		increments[label][city] = delta
	}
	incrRows.Close()

	var result []*model.AnalyticsMultiSeries
	for _, p := range periods {
		if deltas, ok := increments[p.label]; ok {
			for city, delta := range deltas {
				cumulative[city] += delta
			}
		}

		var series []*model.AnalyticsSeriesItem
		for city, value := range cumulative {
			series = append(series, &model.AnalyticsSeriesItem{Name: city, Value: value})
		}
		sort.Slice(series, func(i, j int) bool {
			return series[i].Value > series[j].Value
		})

		result = append(result, &model.AnalyticsMultiSeries{Label: p.label, Series: series})
	}

	return result, nil
}

func (s *Service) GetBookingDistribution(ctx context.Context, input *model.AnalyticsFilter, topX int) ([]*model.AnalyticsPieItem, error) {
	if topX <= 0 {
		topX = 25
	}

	whereClauses, args, argIdx := s.buildBookingTimeFilterClauses(input, 1)
	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, argIdx)
	whereClauses = append(whereClauses, clubClauses...)
	args = append(args, clubArgs...)

	whereStr := ""
	if len(whereClauses) > 0 {
		whereStr = " WHERE " + strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT c.name, COUNT(*)::float8 AS value
		FROM bookings b JOIN clubs c ON b.club_id = c.id%s
		GROUP BY c.id, c.name
		ORDER BY value DESC
	`, whereStr)

	utils.LogSQLWithContext("Get Booking Distribution", query, args...)
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		utils.LogSQLError(err, query, args...)
		return nil, err
	}
	defer rows.Close()

	type distItem struct {
		name  string
		value float64
	}
	var items []distItem
	for rows.Next() {
		var item distItem
		if err := rows.Scan(&item.name, &item.value); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	var result []*model.AnalyticsPieItem
	var othersSum float64
	for i, item := range items {
		if i < topX {
			result = append(result, &model.AnalyticsPieItem{Name: item.name, Value: item.value})
		} else {
			othersSum += item.value
		}
	}

	if othersSum > 0 {
		result = append(result, &model.AnalyticsPieItem{Name: "Others", Value: othersSum})
	}

	return result, nil
}

func (s *Service) GetClubsPerCity(ctx context.Context, input *model.AnalyticsFilter) ([]*model.AnalyticsPieItem, error) {
	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, 1)
	whereStr := ""
	if len(clubClauses) > 0 {
		whereStr = " WHERE " + strings.Join(clubClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT l.name AS city, COUNT(c.id)::float8 AS value
		FROM clubs c
		JOIN locations l ON c.location_id = l.id%s
		GROUP BY l.name
		ORDER BY value DESC
	`, whereStr)

	utils.LogSQLWithContext("Get Clubs Per City", query, clubArgs...)
	rows, err := s.db.QueryContext(ctx, query, clubArgs...)
	if err != nil {
		utils.LogSQLError(err, query, clubArgs...)
		return nil, err
	}
	defer rows.Close()

	var result []*model.AnalyticsPieItem
	for rows.Next() {
		var city string
		var value float64
		if err := rows.Scan(&city, &value); err != nil {
			return nil, err
		}
		result = append(result, &model.AnalyticsPieItem{Name: city, Value: value})
	}

	return result, nil
}

func (s *Service) GetPriceDistribution(ctx context.Context, input *model.AnalyticsFilter) ([]*model.AnalyticsPieItem, error) {
	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, 1)
	whereStr := ""
	if len(clubClauses) > 0 {
		whereStr = " WHERE " + strings.Join(clubClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT
			CASE
				WHEN c.price IS NULL THEN 'Unknown'
				ELSE 'Rp ' || (FLOOR(c.price / 100000) * 100)::text || 'k - ' || ((FLOOR(c.price / 100000) + 1) * 100)::text || 'k'
			END AS bucket,
			COUNT(*)::float8 AS value
		FROM clubs c%s
		GROUP BY bucket
		ORDER BY value DESC
	`, whereStr)

	utils.LogSQLWithContext("Get Price Distribution", query, clubArgs...)
	rows, err := s.db.QueryContext(ctx, query, clubArgs...)
	if err != nil {
		utils.LogSQLError(err, query, clubArgs...)
		return nil, err
	}
	defer rows.Close()

	var result []*model.AnalyticsPieItem
	for rows.Next() {
		var bucket string
		var value float64
		if err := rows.Scan(&bucket, &value); err != nil {
			return nil, err
		}
		result = append(result, &model.AnalyticsPieItem{Name: bucket, Value: value})
	}

	return result, nil
}

func (s *Service) GetCourtDistribution(ctx context.Context, input *model.AnalyticsFilter) ([]*model.AnalyticsPieItem, error) {
	clubClauses, clubArgs, _ := s.buildClubFilterClauses(input, 1)
	whereStr := ""
	if len(clubClauses) > 0 {
		whereStr = " WHERE " + strings.Join(clubClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT (SELECT COUNT(*) FROM courts WHERE courts.club_id = c.id) AS court_count, COUNT(*)::float8 AS value
		FROM clubs c%s
		GROUP BY court_count
		ORDER BY court_count ASC
	`, whereStr)

	utils.LogSQLWithContext("Get Court Distribution", query, clubArgs...)
	rows, err := s.db.QueryContext(ctx, query, clubArgs...)
	if err != nil {
		utils.LogSQLError(err, query, clubArgs...)
		return nil, err
	}
	defer rows.Close()

	type bucketEntry struct {
		sortKey int
		label   string
		value   float64
	}
	var buckets []bucketEntry
	for rows.Next() {
		var courtCount int
		var value float64
		if err := rows.Scan(&courtCount, &value); err != nil {
			return nil, err
		}
		var label string
		sortKey := courtCount
		if courtCount >= 6 {
			label = "6+ Courts"
			sortKey = 6
		} else if courtCount == 1 {
			label = "1 Court"
		} else if courtCount == 0 {
			label = "Unknown"
			sortKey = 999
		} else {
			label = fmt.Sprintf("%d Courts", courtCount)
		}
		buckets = append(buckets, bucketEntry{sortKey: sortKey, label: label, value: value})
	}

	merged := map[string]bucketEntry{}
	for _, b := range buckets {
		if existing, ok := merged[b.label]; ok {
			merged[b.label] = bucketEntry{sortKey: b.sortKey, label: b.label, value: existing.value + b.value}
		} else {
			merged[b.label] = b
		}
	}

	var result []*model.AnalyticsPieItem
	for _, b := range merged {
		result = append(result, &model.AnalyticsPieItem{Name: b.label, Value: b.value})
	}
	sort.Slice(result, func(i, j int) bool {
		return getSortKey(result[i].Name) < getSortKey(result[j].Name)
	})

	return result, nil
}
