const monthNames: Record<string, string> = {
    'januar': '01', 'january': '01', 'jänner': '01', 'jan': '01',
    'februar': '02', 'february': '02', 'feb': '02',
    'märz': '03', 'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'mai': '05', 'may': '05',
    'juni': '06', 'june': '06', 'jun': '06',
    'juli': '07', 'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'oktober': '10', 'october': '10', 'okt': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'dezember': '12', 'december': '12', 'dez': '12', 'dec': '12'
};

const PAST_GRACE_MS = 60 * 24 * 60 * 60 * 1000;

function inferYear(day: string, month: string): string {
    const now = new Date();
    const candidate = new Date(`${now.getFullYear()}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    // Venue pages list upcoming programs: a date far in the past without a year means next year
    if (now.getTime() - candidate.getTime() > PAST_GRACE_MS) {
        return String(now.getFullYear() + 1);
    }
    return String(now.getFullYear());
}

export function extractDateFromText(dateText: string): string {
    if (!dateText) return '';

    const cleanDateText = dateText.trim().replace(/\s+/g, ' ');

    const isoMatch = cleanDateText.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return isoMatch[0];
    }

    const fourDigitYearMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (fourDigitYearMatch) {
        const [_, day, month, year] = fourDigitYearMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const shortYearMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})(?:\s|$)/);
    if (shortYearMatch) {
        const [_, day, month, shortYear] = shortYearMatch;
        return `20${shortYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const noYearMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\./);
    if (noYearMatch) {
        const [_, day, month] = noYearMatch;
        return `${inferYear(day, month)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const abbrevDayMatch = cleanDateText.match(/[A-Za-zäöüÄÖÜ]{2,3}\.?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (abbrevDayMatch) {
        const [_, day, month, year] = abbrevDayMatch;
        const resolvedYear = year ?? inferYear(day, month);
        return `${resolvedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const monthNameMatch = cleanDateText.toLowerCase().match(/(\d{1,2})\.?\s+([a-zäöü]+)\.?\s+(\d{4})/);
    if (monthNameMatch) {
        const [_, day, monthName, year] = monthNameMatch;
        const month = monthNames[monthName.toLowerCase()];
        if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
        }
    }

    return '';
}

export function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}
