const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Builds a YYYY-MM-DD string from a Date's local components.
 * Avoids .toISOString() which converts to UTC and can shift the day.
 */
export const toLocalISODate = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const ROLE_TYPE = {
    DOCTOR: 'DOCTOR'
};

/**
 * Formats a date string (YYYY-MM-DD or ISO timestamp) into "DD MMM YYYY" (e.g. "29 Jun 2026").
 * Fixed format, independent of locale settings.
 * Extracts date parts from the string directly to avoid timezone shifts.
 */
export const formatShortDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return `${day} ${MONTH_SHORT[month]} ${year}`;
};

/**
 * Formats a date string (YYYY-MM-DD or ISO timestamp) into "DD MMM" (e.g. "29 Jun").
 * Fixed format, independent of locale settings.
 */
export const formatShortDateNoYear = (dateStr: string): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return `${day} ${MONTH_SHORT[month]}`;
};

/**
 * Formats a date range (YYYY-MM-DD or ISO timestamps) into "DD MMM - DD MMM YYYY" (e.g. "1 Jun - 28 Jun 2026").
 * Fixed format, independent of locale settings.
 */
export const formatShortDateRange = (startStr: string, endStr: string): string => {
    if (!startStr || !endStr) return 'Select Date Range';
    const startMatch = startStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const endMatch = endStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!startMatch || !endMatch) return 'Select Date Range';
    if (startStr === endStr) return formatShortDate(startStr);
    const startDay = parseInt(startMatch[3], 10);
    const startMonth = parseInt(startMatch[2], 10) - 1;
    const endDay = parseInt(endMatch[3], 10);
    const endMonth = parseInt(endMatch[2], 10) - 1;
    const endYear = parseInt(endMatch[1], 10);
    if (startMatch[1] === endMatch[1]) {
        return `${startDay} ${MONTH_SHORT[startMonth]} - ${endDay} ${MONTH_SHORT[endMonth]} ${endYear}`;
    }
    return `${startDay} ${MONTH_SHORT[startMonth]} ${startMatch[1]} - ${endDay} ${MONTH_SHORT[endMonth]} ${endYear}`;
};

export const DEFAULT_TIMEZONE = 'Asia/Jakarta';

export const formatText = (value: any) => {
    if (value === 0) return '0';
    return String(value || '');
}

export const capitalizeFirstLetter = (value: string): string => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * Capitalizes only the first letter of a string and leaves the rest unchanged.
 */
export const capitalizeFirst = (str: string): string => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Capitalizes the first letter of each word in a string.
 */
export const capitalizeWords = (str: string): string => {
    if (!str) return "";
    return str.replace(/\b\w/g, (char) => char.toUpperCase());
};

export const formatCurrency = (value: any): string => {
    const numValue = Math.round(Number(value) || 0);
    return 'Rp ' + numValue.toLocaleString('id-ID');
}

export const formatPlainCurrency = (value: any): string => {
    try {
        const numValue = Math.round(parseNumber(value) || 0);
        const stringValue = String(value);
        const formattedNumber = numValue.toLocaleString('id-ID');
        if (stringValue !== "" && stringValue.indexOf(',') == stringValue.length - 1) {
            return formattedNumber + ',';
        }
        return formattedNumber;
    } catch (error) {
        console.error('Error formatting plain currency:', error);
        return '0';
    }
}

export const formatNumber = (value: any, digit: number = 0, useThousandSeparator: boolean = true): string => {
    if (value === '-' || value === '-0' || value === '0-' || value === '-,') {
        return '-';
    }
    const numValue = typeof value === 'number' ? value : parseNumber(value) || 0;
    const formattedNumber = numValue.toLocaleString('id-ID', {
        minimumFractionDigits: digit,
        maximumFractionDigits: 8,
        useGrouping: useThousandSeparator
    });
    return formattedNumber;
}

export const parseNumber = (formattedValue: any): number => {
    // Handle non-string inputs
    if (typeof formattedValue === 'number') return formattedValue;
    if (formattedValue === null || formattedValue === undefined) return 0;

    // Convert to string and handle empty cases
    const stringValue = String(formattedValue);
    if (!stringValue || stringValue.trim() === '') return 0;

    // Remove currency symbol and extra spaces
    let cleanValue = stringValue.replace(/Rp\s*/g, '').trim();

    // Preserve sign if present at the start
    const isNegative = /^-/.test(cleanValue);

    // Handle Indonesian format: dots as thousand separators, comma as decimal
    // Remove dots (thousand separators) and replace comma with dot for decimal

    // Improved detection: Only treat dot as decimal if there are NO commas 
    // AND it's not a standard thousand grouping (exactly 3 digits) or intermediate typing (4+ digits)
    const hasDot = cleanValue.includes('.');
    const hasComma = cleanValue.includes(',');

    if (hasComma) {
        // If comma exists, it's definitely the decimal in ID locale. Remove all dots.
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else if (hasDot) {
        const parts = cleanValue.split('.');
        if (parts.length > 2) {
            // Multiple dots -> definitely thousand separators
            cleanValue = cleanValue.replace(/\./g, '');
        } else {
            // Single dot. 
            // In ID locale: 1.000, 2.000 etc are thousands.
            // We treat as thousand separator if it has 3 or more digits after it
            // (Standard grouping or intermediate typing like 1.5000).
            if (parts[1] && parts[1].length >= 3) {
                cleanValue = cleanValue.replace(/\./g, '');
            } else {
                // keep dot as decimal (e.g. 1.5, 1.50)
            }
        }
    }

    // Remove any remaining non-digit and non-dot characters (keep only digits and one dot)
    cleanValue = cleanValue.replace(/[^\d.]/g, '');

    // Re-apply negative sign if needed
    if (isNegative && cleanValue.length > 0 && !cleanValue.startsWith('-')) {
        cleanValue = '-' + cleanValue;
    }

    const number = parseFloat(cleanValue);

    if (isNaN(number)) return 0;

    return number;
}

export const formatLargeNumber = (value: number): string => {
    if (typeof value !== 'number') return value;

    // Format millions
    if (Math.abs(value) >= 1000000) {
        const millions = value / 1000000;
        return `${millions.toLocaleString('id-ID', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
            useGrouping: true
        })} M`;
    }

    // Format thousands
    if (Math.abs(value) >= 100000) {
        const thousands = value / 1000;
        return `${thousands.toLocaleString('id-ID', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
            useGrouping: true
        })} K`;
    }

    // Format regular numbers
    return value.toLocaleString('id-ID', {
        maximumFractionDigits: 1,
        useGrouping: true
    });
}

export const formatDateTime = (date: Date | string | undefined): string => {
    if (!date) return '';

    try {
        let dateObj: Date;

        // Convert input to Date object
        if (typeof date === 'string') {
            dateObj = new Date(date);
        } else {
            dateObj = date;
        }

        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            return '';
        }

        const formatter = new Intl.DateTimeFormat('id-ID', {
            timeZone: DEFAULT_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(dateObj);
        const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));

        const day = partMap.day.padStart(2, '0');
        const month = partMap.month.padStart(2, '0');
        const year = partMap.year;
        const hour = partMap.hour.padStart(2, '0');
        const minute = partMap.minute.padStart(2, '0');

        return `${day}-${month}-${year} ${hour}:${minute}`;

    } catch (error) {
        console.warn('Invalid date format:', date);
        return '';
    }
};

export const toNumberOrUndefined = (value: any, defaultValue?: number): number | undefined => {
    var returnValue = undefined;
    if (value === null || value === undefined || value === '') {
        returnValue = undefined;
        return returnValue;
    }
    const num = parseNumber(value);
    returnValue = isNaN(num) ? defaultValue ? defaultValue : undefined : num;
    return returnValue;
};

export const toNumber = (value: any, defaultValue?: number): number | undefined => {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    const num = parseNumber(value);
    return isNaN(num) ? (defaultValue !== undefined ? defaultValue : undefined) : num;
};

export const toUuidOrNull = (value: any): string | null => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const stringValue = String(value).trim();
    return stringValue === '' ? null : stringValue;
};


/**
 * Formats a person's display name with proper salutation and designation.
 * Especially handles doctors with 'dr.' prefix and optional designation suffix.
 */
export const formatPersonDisplayName = (person: { name?: string; department?: string; designation?: string }): string => {
    if (!person) return '';
    const name = person.name || '';
    const role = person.department;
    const camelName = capitalizeWords(name.toLowerCase());

    if (role === ROLE_TYPE.DOCTOR) {
        const designation = person.designation?.trim();
        return `dr. ${camelName}${designation ? `, ${designation}` : ''}`;
    }
    return camelName;
};

/**
 * Formats a date string/object into a localized long day-date label.
 * Example: "Saturday, 18 April 2026"
 */
export const formatDayDateLabel = (date: Date | string | undefined, language: string = 'en'): string => {
    if (!date) return '';
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return '';

        return dateObj.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: DEFAULT_TIMEZONE
        });
    } catch (error) {
        return '';
    }
};

/**
 * Formats a date to return only the long day name.
 * Example: "Saturday"
 */
export const formatDayLabel = (date: Date | string | undefined, language: string = 'id'): string => {
    if (!date) return '';
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return '';
        return dateObj.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', {
            weekday: 'long',
            timeZone: DEFAULT_TIMEZONE
        });
    } catch (error) {
        return '';
    }
};

/**
 * Formats a date to return only the long date string.
 * Example: "18 April 2026"
 */
export const formatDateLabel = (date: Date | string | undefined, language: string = 'id'): string => {
    if (!date) return '';
    try {
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return '';
        return dateObj.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: DEFAULT_TIMEZONE
        });
    } catch (error) {
        return '';
    }
};

/**
 * Formats a duration in seconds into a MM:SS countdown timer layout.
 * Example: 65 -> "01:05"
 */
export const formatDurationTime = (seconds: number, padMinutes: boolean = true): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const minStr = padMinutes ? mins.toString().padStart(2, '0') : mins.toString();
    const secStr = secs.toString().padStart(2, '0');
    return `${minStr}:${secStr}`;
};

/**
 * Formats a Date object into a YYYY-MM-DD ISO string using local timezone.
 * Example: Date() -> "2026-05-22"
 */
export const formatISODate = (date: Date): string => {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: DEFAULT_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        return formatter.format(date);
    } catch (error) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
};

/**
 * Parses a YYYY-MM-DD string into a Date in local timezone.
 * Example: "2026-05-22" -> local Date(2026, 4, 22)
 */
export const parseISODate = (date: string): Date => {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
};

/**
 * Returns today's date as YYYY-MM-DD in local timezone.
 * Example: Date() -> "2026-05-22"
 */
export const getTodayISODate = (): string => formatISODate(new Date());

/**
 * Formats a Date object into a YYYY-MM string.
 * Example: Date() -> "2026-05"
 */
export const formatISOMonth = (date: Date): string => {
    try {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: DEFAULT_TIMEZONE,
            year: 'numeric',
            month: '2-digit'
        });
        return formatter.format(date);
    } catch (error) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}`;
    }
};

/**
 * Formats a Date object or string into a DDMMYYYY parameter string.
 * Example: "2026-05-22" -> "22052026"
 */
export const formatParamDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    try {
        const formatter = new Intl.DateTimeFormat('id-ID', {
            timeZone: DEFAULT_TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(d);
        const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return `${partMap.day.padStart(2, '0')}${partMap.month.padStart(2, '0')}${partMap.year}`;
    } catch (error) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}${mm}${yyyy}`;
    }
};

export const getMarkerColor = (index: number): string => {
    if (index < 10) return '#059669'; // Emerald-600
    if (index < 20) return '#2563eb'; // Blue-600
    if (index < 30) return '#ea580c'; // Orange-600
    return '#4b5563'; // Gray-600
};
