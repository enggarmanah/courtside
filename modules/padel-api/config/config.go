package config

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

type AppConfig struct {
	Port              string
	Environment       string
	DBHost            string
	DBPort            int
	DBUser            string
	DBPassword        string
	DBName            string
	DBSSLMode         string
	JWTSecret         string
	AllowedOrigins    string
	CourtsideEmail    string
	CourtsidePassword string
}

func (c *AppConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode,
	)
}

func (c *AppConfig) Connect() (*sql.DB, error) {
	db, err := sql.Open("postgres", c.DSN())
	if err != nil {
		return nil, fmt.Errorf("error opening database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("error connecting to database: %w", err)
	}

	return db, nil
}

var globalConfig *AppConfig

func GetConfig() *AppConfig {
	if globalConfig == nil {
		globalConfig = LoadFromEnv()
	}
	return globalConfig
}

func LoadFromEnv() *AppConfig {
	port := getEnvOrDefault("PORT", "8080")
	env := getEnvOrDefault("ENV", "dev")
	dbHost := getEnvOrDefault("DB_HOST", "localhost")
	dbPort := getEnvAsIntOrDefault("DB_PORT", 5432)
	dbUser := getEnvOrDefault("DB_USER", "postgres")
	dbPassword := getEnvOrDefault("DB_PASSWORD", "")
	dbName := getEnvOrDefault("DB_NAME", "padelitics")
	dbSSLMode := getEnvOrDefault("DB_SSL_MODE", "disable")
	jwtSecret := getEnvOrDefault("JWT_SECRET_KEY", "padel-api-secret-key-change-in-production")
	allowedOrigins := strings.TrimRight(getEnvOrDefault("ALLOWED_ORIGINS", "*"), "/")
	courtsideEmail := getEnvOrDefault("COURTSIDE_EMAIL", "")
	courtsidePassword := getEnvOrDefault("COURTSIDE_PASSWORD", "")

	return &AppConfig{
		Port:              port,
		Environment:       env,
		DBHost:            dbHost,
		DBPort:            dbPort,
		DBUser:            dbUser,
		DBPassword:        dbPassword,
		DBName:            dbName,
		DBSSLMode:         dbSSLMode,
		JWTSecret:         jwtSecret,
		AllowedOrigins:    allowedOrigins,
		CourtsideEmail:    courtsideEmail,
		CourtsidePassword: courtsidePassword,
	}
}

func init() {
	paths := []string{
		"config.properties",
		"../config.properties",
		"../../config.properties",
		"db/config.properties",
	}

	for _, path := range paths {
		err := loadProperties(path)
		if err == nil {
			log.Printf("Loaded config from: %s\n", path)
			return
		}
	}

	log.Println("Warning: Could not load config.properties file in any search paths")
}

func loadProperties(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])

		if os.Getenv(key) == "" {
			os.Setenv(key, value)
		}
	}

	return scanner.Err()
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}