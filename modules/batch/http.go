package main

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"time"
)

var httpClient = &http.Client{
	Timeout: 60 * time.Second,
	Transport: &http.Transport{
		TLSHandshakeTimeout: 30 * time.Second,
	},
}

func apiRequest(method, url, token string, body []byte) ([]byte, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 2 * time.Second)
		}
		var bodyReader io.Reader
		if body != nil {
			bodyReader = bytes.NewReader(body)
		}
		req, err := http.NewRequest(method, url, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("accept", "application/json")
		req.Header.Set("user-agent", "Courtside/1.1.34")
		if token != "" {
			req.Header.Set("authorization", "Bearer "+token)
		}
		if method == "POST" {
			req.Header.Set("content-type", "application/json")
		}

		resp, err := httpClient.Do(req)
		if err != nil {
			lastErr = err
			if isRetryable(err) {
				continue
			}
			return nil, fmt.Errorf("request failed: %w", err)
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("failed to read response: %w", err)
		}
		return respBody, nil
	}
	return nil, fmt.Errorf("request failed after 3 attempts: %w", lastErr)
}

func isRetryable(err error) bool {
	if err == nil {
		return false
	}
	if tlsErr, ok := err.(tls.RecordHeaderError); ok {
		_ = tlsErr
		return true
	}
	errStr := err.Error()
	return errStr == "net: TLS handshake timeout" ||
		errStr == "net/http: TLS handshake timeout" ||
		errStr == "context deadline exceeded" ||
		errStr == "connection refused" ||
		errStr == "timeout"
}