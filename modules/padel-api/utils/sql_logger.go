package utils

import (
	"fmt"
	"log"
	"os"
	"reflect"
	"regexp"
	"strings"
	"time"
)

var (
	sqlEnabled = true
	stdoutLog  = log.New(os.Stdout, "", log.LstdFlags)
	stderrLog  = log.New(os.Stderr, "", log.LstdFlags)
)

func EnableSQLLogging(enabled bool) {
	sqlEnabled = enabled
}

func formatValue(value interface{}) (result string) {
	defer func() {
		if r := recover(); r != nil {
			result = fmt.Sprintf("ERR_LOGGING_VALUE(%v)", r)
		}
	}()

	if value == nil {
		return "NULL"
	}

	switch v := value.(type) {
	case string:
		escaped := strings.ReplaceAll(v, "'", "''")
		return fmt.Sprintf("'%s'", escaped)
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", v)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", v)
	case float32, float64:
		return fmt.Sprintf("%f", v)
	case bool:
		return fmt.Sprintf("%t", v)
	case time.Time:
		return fmt.Sprintf("'%s'", v.Format("2006-01-02 15:04:05"))
	case []byte:
		return fmt.Sprintf("'%s'", string(v))
	default:
		rv := reflect.ValueOf(v)
		if !rv.IsValid() {
			return "NULL"
		}

		k := rv.Kind()
		if k == reflect.Ptr || k == reflect.Interface || k == reflect.Slice || k == reflect.Map || k == reflect.Chan || k == reflect.Func {
			if rv.IsNil() {
				return "NULL"
			}
		}

		if k == reflect.Ptr {
			rv = rv.Elem()
			k = rv.Kind()
		}

		switch k {
		case reflect.String:
			escaped := strings.ReplaceAll(rv.String(), "'", "''")
			return fmt.Sprintf("'%s'", escaped)
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			return fmt.Sprintf("%d", rv.Int())
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			return fmt.Sprintf("%d", rv.Uint())
		case reflect.Float32, reflect.Float64:
			return fmt.Sprintf("%f", rv.Float())
		case reflect.Bool:
			return fmt.Sprintf("%t", rv.Bool())
		default:
			valueStr := fmt.Sprintf("%v", rv.Interface())
			if strings.HasPrefix(valueStr, "0x") {
				return "NULL"
			}
			if valueStr == "<nil>" {
				return "NULL"
			}
			if strings.Contains(valueStr, "'") || strings.Contains(valueStr, ";") {
				escaped := strings.ReplaceAll(valueStr, "'", "''")
				return fmt.Sprintf("'%s'", escaped)
			}
			if !strings.HasPrefix(valueStr, "'") && !strings.HasSuffix(valueStr, "'") {
				if _, err := fmt.Sscanf(valueStr, "%f", new(float64)); err != nil {
					escaped := strings.ReplaceAll(valueStr, "'", "''")
					return fmt.Sprintf("'%s'", escaped)
				}
			}
			return valueStr
		}
	}
}

func FormatSQL(query string, args ...interface{}) string {
	if len(args) == 0 {
		return query
	}

	re := regexp.MustCompile(`\$(\d+)`)
	formattedQuery := re.ReplaceAllStringFunc(query, func(match string) string {
		paramNum := strings.TrimPrefix(match, "$")
		var paramIndex int
		if _, err := fmt.Sscanf(paramNum, "%d", &paramIndex); err != nil {
			return match
		}
		paramIndex--
		if paramIndex >= 0 && paramIndex < len(args) {
			return formatValue(args[paramIndex])
		}
		return match
	})

	return formattedQuery
}

func LogSQLWithContext(context string, query string, args ...interface{}) {
	if !sqlEnabled {
		return
	}
	formattedQuery := FormatSQL(query, args...)
	stdoutLog.Printf("[SQL] %s\n%s", context, formattedQuery)
}

func LogSQLError(err error, query string, args ...interface{}) {
	if !sqlEnabled {
		return
	}
	formattedQuery := FormatSQL(query, args...)
	stderrLog.Printf("[SQL ERROR] %v\nQuery: %s", err, formattedQuery)
}