export function viennaHour(now: Date = new Date()): number {
    return Number(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/Vienna',
            hour: '2-digit',
            hour12: false,
        }).format(now)
    );
}

export function todayInVienna(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Vienna',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}
