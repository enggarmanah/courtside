FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o crawler-bin .

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/crawler-bin /app/crawler-bin
RUN apk add --no-cache ca-certificates && touch /app/config.properties
EXPOSE 8080
CMD ["/app/crawler-bin"]
