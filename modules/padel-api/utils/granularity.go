package utils

import "time"

const DailyGranularityMaxDays = 45

func DetermineGranularity(from, to time.Time) (string, int) {
	daysDiff := int(to.Sub(from).Hours()/24) + 1
	if daysDiff <= 0 {
		daysDiff = 1
	}
	if daysDiff == 1 {
		return "hourly", daysDiff
	}
	if daysDiff <= DailyGranularityMaxDays {
		return "daily", daysDiff
	}
	return "monthly", daysDiff
}

func GranularityLabelFormat(granularity string) string {
	switch granularity {
	case "hourly":
		return "HH24:00"
	case "daily":
		return "DD Mon"
	default:
		return "Mon YYYY"
	}
}

func GranularityTrunc(granularity string) string {
	switch granularity {
	case "hourly":
		return "hour"
	case "daily":
		return "day"
	default:
		return "month"
	}
}
