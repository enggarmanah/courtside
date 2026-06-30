package utils

import (
	"fmt"
	"strings"
)

type QueryBuilder struct {
    SelectClause string
    FromClause   string
    WhereClauses []string
    GroupBy      string
    Args         []interface{}
    OrderBy      string
    Limit        int
    Offset       int
    argCounter   int
    whereArgsLen int
}

func NewQueryBuilder(selectClause, fromClause string) *QueryBuilder {
	return &QueryBuilder{
		SelectClause: selectClause,
		FromClause:   fromClause,
		argCounter:   0,
	}
}

func (qb *QueryBuilder) AddWhere(condition string, args ...interface{}) {
    if condition != "" {
        paramCondition := condition
        for range args {
            qb.argCounter++
            paramCondition = strings.Replace(paramCondition, "?", fmt.Sprintf("$%d", qb.argCounter), 1)
        }
        qb.WhereClauses = append(qb.WhereClauses, paramCondition)
        qb.Args = append(qb.Args, args...)
        qb.whereArgsLen = len(qb.Args)
    }
}

func (qb *QueryBuilder) SetOrderBy(orderBy string) {
	qb.OrderBy = orderBy
}

func (qb *QueryBuilder) SetGroupBy(groupBy string) {
	qb.GroupBy = groupBy
}

func (qb *QueryBuilder) SetLimit(limit int) {
	qb.Limit = limit
}

func (qb *QueryBuilder) SetOffset(offset int) {
	qb.Offset = offset
}

func (qb *QueryBuilder) GetWhereArgs() []interface{} {
    return qb.Args[:qb.whereArgsLen]
}

func (qb *QueryBuilder) Build() string {
	var query strings.Builder

	query.WriteString(fmt.Sprintf("SELECT %s FROM %s", qb.SelectClause, qb.FromClause))

	if len(qb.WhereClauses) > 0 {
		query.WriteString(" WHERE ")
		query.WriteString(strings.Join(qb.WhereClauses, " AND "))
	}

	if qb.GroupBy != "" {
		query.WriteString(fmt.Sprintf(" GROUP BY %s", qb.GroupBy))
	}

	if qb.OrderBy != "" {
		query.WriteString(fmt.Sprintf(" ORDER BY %s", qb.OrderBy))
	}

	if qb.Limit > 0 {
		qb.argCounter++
		query.WriteString(fmt.Sprintf(" LIMIT $%d", qb.argCounter))
		qb.Args = append(qb.Args, qb.Limit)
	}

	if qb.Offset > 0 {
		qb.argCounter++
		query.WriteString(fmt.Sprintf(" OFFSET $%d", qb.argCounter))
		qb.Args = append(qb.Args, qb.Offset)
	}

	return query.String()
}

func (qb *QueryBuilder) BuildCountQuery() string {
	if qb.GroupBy != "" {
		var query strings.Builder
		query.WriteString(fmt.Sprintf("SELECT COUNT(*) FROM (SELECT 1 FROM %s", qb.FromClause))
		if len(qb.WhereClauses) > 0 {
			query.WriteString(" WHERE ")
			query.WriteString(strings.Join(qb.WhereClauses, " AND "))
		}
		query.WriteString(fmt.Sprintf(" GROUP BY %s) AS sub", qb.GroupBy))
		return query.String()
	}

	var query strings.Builder
	query.WriteString(fmt.Sprintf("SELECT COUNT(*) FROM %s", qb.FromClause))
	if len(qb.WhereClauses) > 0 {
		query.WriteString(" WHERE ")
		query.WriteString(strings.Join(qb.WhereClauses, " AND "))
	}
	return query.String()
}