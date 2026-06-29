package main

import (
	"encoding/json"
	"fmt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

func login(email, password string) (*LoginResponse, error) {
	body := LoginRequest{Email: email, Password: password}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal login request: %w", err)
	}

	respBody, err := apiRequest("POST", "https://api.courtside.id/api/mobile/auth/login", "", payload)
	if err != nil {
		return nil, fmt.Errorf("login failed: %w", err)
	}

	var loginResp LoginResponse
	if err := json.Unmarshal(respBody, &loginResp); err != nil {
		return nil, fmt.Errorf("failed to parse login response: %w", err)
	}

	return &loginResp, nil
}