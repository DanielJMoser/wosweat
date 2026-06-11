export function eventId(...parts: string[]): string {
    const input = parts.join('|');
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
    }
    return `event-${hash.toString(36)}`;
}
