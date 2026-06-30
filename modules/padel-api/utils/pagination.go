package utils

type PaginatedResult struct {
	TotalCount  int `json:"totalCount"`
	TotalPages  int `json:"totalPages"`
	HasNextPage bool `json:"hasNextPage"`
}

func CalculateOffset(page, pageSize int) int {
	if page < 1 {
		page = 1
	}
	return (page - 1) * pageSize
}

func BuildPaginatedResult(totalCount, page, pageSize int) PaginatedResult {
	if pageSize <= 0 {
		pageSize = 10
	}

	totalPages := (totalCount + pageSize - 1) / pageSize
	if totalPages < 0 {
		totalPages = 0
	}

	hasNextPage := page*pageSize < totalCount

	return PaginatedResult{
		TotalCount:  totalCount,
		TotalPages:  totalPages,
		HasNextPage: hasNextPage,
	}
}