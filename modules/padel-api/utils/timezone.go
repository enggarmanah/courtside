package utils

import "time"

// TimeZoneAsiaJakarta is the standardized timezone (GMT+7) for the application.
var TimeZoneAsiaJakarta = time.FixedZone("Asia/Jakarta", 7*60*60)

// ToJakartaTime converts a given time to Asia/Jakarta (GMT+7) timezone.
func ToJakartaTime(t time.Time) time.Time {
	return t.In(TimeZoneAsiaJakarta)
}

// ForceJakartaTimeZone treats the time's raw clock readings as being in Asia/Jakarta (GMT+7).
func ForceJakartaTimeZone(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), TimeZoneAsiaJakarta)
}
