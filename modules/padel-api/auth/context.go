package auth

import "context"

type contextKey string

const UserContextKey contextKey = "user"

type AuthUser struct {
	UserID string
	Name   string
	Email  string
}

func GetAuthUser(ctx context.Context) AuthUser {
	val := ctx.Value(UserContextKey)
	if val == nil {
		return AuthUser{}
	}
	return val.(AuthUser)
}

func WithUser(ctx context.Context, user AuthUser) context.Context {
	return context.WithValue(ctx, UserContextKey, user)
}