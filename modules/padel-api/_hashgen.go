package main

import (
	"fmt"
	"padel-api/auth"
)

func main() {
	h, err := auth.HashPassword("password123")
	if err != nil {
		panic(err)
	}
	fmt.Println(h)
}