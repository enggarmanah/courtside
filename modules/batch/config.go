package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Email      string   `json:"email"`
	Password   string   `json:"password"`
	DBHost     string   `json:"db_host"`
	DBPort     string   `json:"db_port"`
	DBUser     string   `json:"db_user"`
	DBPassword string   `json:"db_password"`
	DBName     string   `json:"db_name"`
	DBSSLMode  string   `json:"db_ssl_mode"`
	Locations  []string `json:"locations"`
	Clubs      []string `json:"clubs"`
}

func loadConfig(path string) (*Config, error) {
	cfg := &Config{}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		switch key {
		case "email", "COURTSIDE_EMAIL":
			cfg.Email = val
		case "password", "COURTSIDE_PASSWORD":
			cfg.Password = val
		case "DB_HOST":
			cfg.DBHost = val
		case "DB_PORT":
			cfg.DBPort = val
		case "DB_USER":
			cfg.DBUser = val
		case "DB_PASSWORD":
			cfg.DBPassword = val
		case "DB_NAME":
			cfg.DBName = val
		case "DB_SSL_MODE":
			cfg.DBSSLMode = val
		case "LOCATIONS":
			locParts := strings.Split(val, ",")
			for _, p := range locParts {
				p = strings.TrimSpace(p)
				if p != "" {
					cfg.Locations = append(cfg.Locations, p)
				}
			}
		case "CLUBS":
			clubParts := strings.Split(val, ",")
			for _, p := range clubParts {
				p = strings.TrimSpace(p)
				if p != "" {
					cfg.Clubs = append(cfg.Clubs, p)
				}
			}
		}
	}

	applyEnvOverrides(cfg)
	applySecretJSONOverride(cfg)

	return cfg, nil
}

func applyEnvOverrides(cfg *Config) {
	if v := os.Getenv("COURTSIDE_EMAIL"); v != "" {
		cfg.Email = v
	}
	if v := os.Getenv("COURTSIDE_PASSWORD"); v != "" {
		cfg.Password = v
	}
	if v := os.Getenv("DB_HOST"); v != "" {
		cfg.DBHost = v
	}
	if v := os.Getenv("DB_PORT"); v != "" {
		cfg.DBPort = v
	}
	if v := os.Getenv("DB_USER"); v != "" {
		cfg.DBUser = v
	}
	if v := os.Getenv("DB_PASSWORD"); v != "" {
		cfg.DBPassword = v
	}
	if v := os.Getenv("DB_NAME"); v != "" {
		cfg.DBName = v
	}
	if v := os.Getenv("DB_SSL_MODE"); v != "" {
		cfg.DBSSLMode = v
	}
	if v := os.Getenv("LOCATIONS"); v != "" {
		cfg.Locations = nil
		for _, p := range strings.Split(v, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				cfg.Locations = append(cfg.Locations, p)
			}
		}
	}
	if v := os.Getenv("CLUBS"); v != "" {
		cfg.Clubs = nil
		for _, p := range strings.Split(v, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				cfg.Clubs = append(cfg.Clubs, p)
			}
		}
	}
}

func applySecretJSONOverride(cfg *Config) {
	envFile := os.Getenv("CONFIG_SECRET_PATH")
	if envFile == "" {
		return
	}

	data, err := os.ReadFile(envFile)
	if err != nil {
		return
	}

	var secretCfg Config
	if err := json.Unmarshal(data, &secretCfg); err != nil {
		return
	}

	if secretCfg.Email != "" {
		cfg.Email = secretCfg.Email
	}
	if secretCfg.Password != "" {
		cfg.Password = secretCfg.Password
	}
	if secretCfg.DBHost != "" {
		cfg.DBHost = secretCfg.DBHost
	}
	if secretCfg.DBPort != "" {
		cfg.DBPort = secretCfg.DBPort
	}
	if secretCfg.DBUser != "" {
		cfg.DBUser = secretCfg.DBUser
	}
	if secretCfg.DBPassword != "" {
		cfg.DBPassword = secretCfg.DBPassword
	}
	if secretCfg.DBName != "" {
		cfg.DBName = secretCfg.DBName
	}
	if secretCfg.DBSSLMode != "" {
		cfg.DBSSLMode = secretCfg.DBSSLMode
	}
	if len(secretCfg.Locations) > 0 {
		cfg.Locations = secretCfg.Locations
	}
	if len(secretCfg.Clubs) > 0 {
		cfg.Clubs = secretCfg.Clubs
	}
}