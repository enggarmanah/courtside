package user

import (
	"database/sql"
	"log"
	"padel-api/auth"
	"padel-api/graph/model"
	"time"
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) Authenticate(userid, password string) (*model.AuthPayload, error) {
	var user model.User
	err := s.db.QueryRow(
		`SELECT id, name, email, userid, status FROM users WHERE userid = $1`,
		userid,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Userid, &user.Status)
	if err != nil {
		return nil, err
	}

	var hashedPassword string
	err = s.db.QueryRow(`SELECT password FROM users WHERE userid = $1`, userid).Scan(&hashedPassword)
	if err != nil {
		return nil, err
	}

	if !auth.ComparePassword(password, hashedPassword) {
		return nil, sql.ErrNoRows
	}

	token, err := auth.GenerateToken(map[string]interface{}{
		"user_id": user.ID,
		"name":    user.Name,
		"email":   user.Email,
	})
	if err != nil {
		return nil, err
	}

	refreshClaims := map[string]interface{}{
		"user_id": user.ID,
		"type":    auth.TokenTypeRefresh,
		"exp":     time.Now().UTC().Add(auth.RefreshTokenDuration).Unix(),
	}
	refreshToken, err := auth.GenerateToken(refreshClaims)
	if err != nil {
		return nil, err
	}

	expiresIn := int(auth.AccessTokenDuration.Seconds())

	return &model.AuthPayload{
		User:         &user,
		Token:        token,
		RefreshToken: "stateless_" + refreshToken,
		ExpiresIn:    expiresIn,
	}, nil
}

func (s *Service) RefreshToken(refreshToken string) (*model.AuthPayload, error) {
	token := refreshToken
	if len(token) > 10 && token[:10] == "stateless_" {
		token = token[10:]
	}

	log.Printf("[AUTH] RefreshToken validate raw token len=%d", len(token))
	claims, err := auth.ValidateToken(token)
	if err != nil {
		log.Printf("[AUTH] RefreshToken validate error=%v", err)
		return nil, err
	}

	if !auth.IsRefreshToken(claims) {
		log.Printf("[AUTH] RefreshToken rejected: not a refresh token")
		return nil, sql.ErrNoRows
	}

	userID, _ := claims["user_id"].(string)
	if userID == "" {
		return nil, sql.ErrNoRows
	}

	var user model.User
	err = s.db.QueryRow(
		`SELECT id, name, email, userid, status FROM users WHERE id = $1`,
		userID,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Userid, &user.Status)
	if err != nil {
		return nil, err
	}

	newToken, err := auth.GenerateToken(map[string]interface{}{
		"user_id": user.ID,
		"name":    user.Name,
		"email":   user.Email,
	})
	if err != nil {
		return nil, err
	}

	// Generate a new stateless refresh token
	newRefreshClaims := map[string]interface{}{
		"user_id": user.ID,
		"type":    auth.TokenTypeRefresh,
		"exp":     time.Now().UTC().Add(auth.RefreshTokenDuration).Unix(),
	}
	newRefreshToken, err := auth.GenerateToken(newRefreshClaims)
	if err != nil {
		return nil, err
	}

	expiresIn := int(auth.AccessTokenDuration.Seconds())
	log.Printf("[AUTH] RefreshToken user=%s expiresIn=%d", user.Userid, expiresIn)

	return &model.AuthPayload{
		User:         &user,
		Token:        newToken,
		RefreshToken: "stateless_" + newRefreshToken,
		ExpiresIn:    expiresIn,
	}, nil
}

func (s *Service) GetByID(id string) (*model.User, error) {
	var user model.User
	err := s.db.QueryRow(
		`SELECT id, name, email, userid, status FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Userid, &user.Status)
	if err != nil {
		return nil, err
	}
	return &user, nil
}