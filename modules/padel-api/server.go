package main

import (
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"padel-api/auth"
	"padel-api/club"
	"padel-api/config"
	"padel-api/dashboard"
	"padel-api/graph"
	"padel-api/graph/generated"
	"padel-api/user"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/extension"
	"github.com/99designs/gqlgen/graphql/playground"
)

func init() {
	// Set the global default timezone to Asia/Jakarta (GMT+7)
	time.Local = time.FixedZone("Asia/Jakarta", 7*60*60)
}

const defaultPort = "8080"

func corsMiddleware(allowedOrigins string, next http.Handler) http.Handler {
	origins := map[string]bool{}
	for _, o := range strings.Split(allowedOrigins, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins[o] = true
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqOrigin := r.Header.Get("Origin")
		if reqOrigin != "" {
			if origins[reqOrigin] || origins["*"] {
				w.Header().Set("Access-Control-Allow-Origin", reqOrigin)
			}
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Accept, Authorization, Content-Type, X-Request-Type, Cache-Control, Pragma, X-Requested-With, Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[HTTP] %s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	cfg := config.GetConfig()

	db, err := cfg.Connect()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	userService := user.NewService(db)
	dashboardService := dashboard.NewService(db)
	clubService := club.NewService(db)

	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
		Resolvers: &graph.Resolver{
			UserService:      userService,
			DashboardService: dashboardService,
			ClubService:      clubService,
		},
	}))

	srv.Use(extension.Introspection{})

	mux := http.NewServeMux()
	mux.Handle("/", playground.Handler("GraphQL playground", "/query"))

	allowedOrigins := cfg.AllowedOrigins
	if allowedOrigins == "" {
		allowedOrigins = os.Getenv("ALLOWED_ORIGINS")
	}
	if allowedOrigins == "" {
		allowedOrigins = "*"
	}
	log.Printf("CORS allowed origins: %s", allowedOrigins)

	mux.Handle("/query", auth.AuthMiddleware(corsMiddleware(allowedOrigins, srv)))

	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, loggingMiddleware(mux)))
}