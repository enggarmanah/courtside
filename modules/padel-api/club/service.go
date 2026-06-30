package club

import (
	"database/sql"
	"fmt"
	"padel-api/graph/model"
	"padel-api/utils"
	"strings"
	"time"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) GetClubs(input model.ClubsInput) (*model.ClubsResult, error) {
	selectClause := `id, name, sub_name, address, email, whatsapp, instagram, logo_path, lat, lng, link_map, opening_hours::text, opening_date, location_id, price, (SELECT COUNT(*) FROM courts WHERE courts.club_id = clubs.id) AS court_count`

	qb := utils.NewQueryBuilder(selectClause, `clubs`)

	if input.LocationID != nil && *input.LocationID != "" {
		qb.AddWhere("location_id = ?", *input.LocationID)
	}

	if input.Search != nil && *input.Search != "" {
		searchTerm := "%" + *input.Search + "%"
		qb.AddWhere("(name ILIKE ? OR address ILIKE ? OR email ILIKE ?)", searchTerm, searchTerm, searchTerm)
	}

	if input.MinCourtCount != nil {
		qb.AddWhere("(SELECT COUNT(*) FROM courts WHERE courts.club_id = clubs.id) >= ?", *input.MinCourtCount)
	}
	if input.MaxCourtCount != nil {
		qb.AddWhere("(SELECT COUNT(*) FROM courts WHERE courts.club_id = clubs.id) <= ?", *input.MaxCourtCount)
	}
	if input.MinPrice != nil {
		qb.AddWhere("price >= ?", *input.MinPrice)
	}
	if input.MaxPrice != nil {
		qb.AddWhere("price <= ?", *input.MaxPrice)
	}
	if input.OpeningDateBefore != nil && *input.OpeningDateBefore != "" {
		qb.AddWhere("opening_date <= ?", *input.OpeningDateBefore)
	}
	if input.OpeningDateAfter != nil && *input.OpeningDateAfter != "" {
		qb.AddWhere("opening_date >= ?", *input.OpeningDateAfter)
	}

	sortField := "name"
	if input.SortField != nil && *input.SortField != "" {
		sortField = *input.SortField
	}
	sortOrder := "ASC"
	if input.SortOrder != nil && strings.ToUpper(*input.SortOrder) == "DESC" {
		sortOrder = "DESC"
	}
	qb.SetOrderBy(fmt.Sprintf("%s %s", sortField, sortOrder))

	offset := utils.CalculateOffset(input.Page, input.PageSize)
	qb.SetLimit(input.PageSize)
	qb.SetOffset(offset)

	query := qb.Build()
	utils.LogSQLWithContext("Club List - Data", query, qb.Args...)
	rows, err := s.db.Query(query, qb.Args...)
	if err != nil {
		utils.LogSQLError(err, query, qb.Args...)
		return nil, err
	}
	defer rows.Close()

	var clubs []*model.Club
	for rows.Next() {
		var c struct {
			ID          string
			Name        string
			SubName     *string
			Address     *string
			Email       *string
			Whatsapp    *string
			Instagram   *string
			LogoPath    *string
			Lat         *float64
			Lng         *float64
			LinkMap     *string
			OpeningHour *string
			OpeningDate *time.Time
			LocationID  string
			Price       *float64
			CourtCount  *int
		}
		err := rows.Scan(
			&c.ID, &c.Name, &c.SubName, &c.Address, &c.Email, &c.Whatsapp,
			&c.Instagram, &c.LogoPath, &c.Lat, &c.Lng, &c.LinkMap,
			&c.OpeningHour, &c.OpeningDate, &c.LocationID, &c.Price,
			&c.CourtCount,
		)
		if err != nil {
			utils.LogSQLError(err, query, qb.Args...)
			return nil, err
		}

		club := &model.Club{
			ID:         c.ID,
			Name:       c.Name,
			SubName:    c.SubName,
			Address:    c.Address,
			Email:      c.Email,
			Whatsapp:   c.Whatsapp,
			Instagram:  c.Instagram,
			LogoPath:   c.LogoPath,
			Lat:        c.Lat,
			Lng:        c.Lng,
			LinkMap:    c.LinkMap,
			LocationID: c.LocationID,
			Price:      c.Price,
			CourtCount: c.CourtCount,
		}
		if !c.OpeningDate.IsZero() {
			club.OpeningDate = c.OpeningDate
		}
		clubs = append(clubs, club)
	}

  var totalCount int
  countQuery := qb.BuildCountQuery()
  countArgs := qb.GetWhereArgs()
  utils.LogSQLWithContext("Club List - Count", countQuery, countArgs...)
	err = s.db.QueryRow(countQuery, countArgs...).Scan(&totalCount)
	if err != nil {
		utils.LogSQLError(err, countQuery, countArgs...)
		return nil, err
	}

	pagination := utils.BuildPaginatedResult(totalCount, input.Page, input.PageSize)

	return &model.ClubsResult{
		Clubs:       clubs,
		TotalCount:  pagination.TotalCount,
		TotalPages:  pagination.TotalPages,
		HasNextPage: pagination.HasNextPage,
	}, nil
}

func (s *Service) GetByID(id string) (*model.Club, error) {
	query := `SELECT id, name, sub_name, address, email, whatsapp, instagram, logo_path, lat, lng, link_map, opening_hours::text, opening_date, location_id, price, (SELECT COUNT(*) FROM courts WHERE courts.club_id = clubs.id) FROM clubs WHERE id = $1`
	utils.LogSQLWithContext("Club Get By ID", query, id)

	var c struct {
		ID          string
		Name        string
		SubName     *string
		Address     *string
		Email       *string
		Whatsapp    *string
		Instagram   *string
		LogoPath    *string
		Lat         *float64
		Lng         *float64
		LinkMap     *string
		OpeningHour *string
		OpeningDate  *time.Time
		LocationID  string
		Price       *float64
		CourtCount  *int
	}

	err := s.db.QueryRow(query, id).Scan(
		&c.ID, &c.Name, &c.SubName, &c.Address, &c.Email, &c.Whatsapp,
		&c.Instagram, &c.LogoPath, &c.Lat, &c.Lng, &c.LinkMap,
		&c.OpeningHour, &c.OpeningDate, &c.LocationID, &c.Price,
		&c.CourtCount,
	)
	if err != nil {
		utils.LogSQLError(err, query, id)
		return nil, err
	}

	return &model.Club{
		ID:         c.ID,
		Name:       c.Name,
		SubName:    c.SubName,
		Address:    c.Address,
		Email:      c.Email,
		Whatsapp:   c.Whatsapp,
		Instagram:  c.Instagram,
		LogoPath:   c.LogoPath,
		Lat:        c.Lat,
		Lng:        c.Lng,
		LinkMap:    c.LinkMap,
		OpeningDate: c.OpeningDate,
		LocationID: c.LocationID,
		Price:      c.Price,
		CourtCount: c.CourtCount,
	}, nil
}