package graph

import (
	"padel-api/club"
	"padel-api/dashboard"
	"padel-api/user"
)

type Resolver struct {
	UserService      *user.Service
	DashboardService *dashboard.Service
	ClubService      *club.Service
}