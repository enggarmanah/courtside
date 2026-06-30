package auth

import (
	"padel-api/config"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

var secretKey []byte

func init() {
	cfg := config.GetConfig()
	secretKey = []byte(cfg.JWTSecret)
}

const (
	TokenTypeAccess  = "access"
	TokenTypeRefresh = "refresh"
)

const (
	AccessTokenDuration  = 60 * 60 * time.Second
	RefreshTokenDuration = 30 * 24 * time.Hour
)

func GenerateToken(claims map[string]interface{}) (string, error) {
	if _, exists := claims["exp"]; !exists {
		claims["exp"] = time.Now().UTC().Add(AccessTokenDuration).Unix()
	}
	if _, exists := claims["iat"]; !exists {
		claims["iat"] = time.Now().UTC().Unix()
	}
	if _, exists := claims["type"]; !exists {
		claims["type"] = TokenTypeAccess
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims(claims))
	return token.SignedString(secretKey)
}

func ValidateToken(tokenString string) (jwt.MapClaims, error) {
	claims := jwt.MapClaims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return secretKey, nil
	})

	if err != nil || !token.Valid {
		return nil, err
	}

	return claims, nil
}

func IsRefreshToken(claims jwt.MapClaims) bool {
	if tokenType, exists := claims["type"]; exists {
		return tokenType == TokenTypeRefresh
	}
	return false
}

func IsAccessToken(claims jwt.MapClaims) bool {
	if tokenType, exists := claims["type"]; exists {
		return tokenType == TokenTypeAccess
	}
	return false
}
