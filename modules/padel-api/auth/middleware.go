package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "OPTIONS" {
			next.ServeHTTP(w, r)
			return
		}

		requestType := r.Header.Get("X-Request-Type")
		if requestType == "authenticate" || requestType == "refresh" {
			next.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			fmt.Println("[AUTH] 401: Authorization header missing")
			http.Error(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
		claims, err := ValidateToken(tokenString)
		if err != nil {
			fmt.Printf("[AUTH] 401: Token parsing error: %v\n", err)
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		getString := func(key string) string {
			if value, exists := claims[key]; exists && value != nil {
				if str, ok := value.(string); ok {
					return str
				}
			}
			return ""
		}

		if exp, exists := claims["exp"]; exists {
			if expFloat, ok := exp.(float64); ok {
				remaining := int64(expFloat) - time.Now().UTC().Unix()
				fmt.Printf("[AUTH] token exp remaining=%ds user=%s\n", remaining, getString("user_id"))
			}
		}

		userClaims := AuthUser{
			UserID: getString("user_id"),
			Email:  getString("email"),
			Name:   getString("name"),
		}

		ctx := context.WithValue(r.Context(), UserContextKey, userClaims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}