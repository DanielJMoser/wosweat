import { EditorialContent } from './editorial';

const API_VERSION = 'v2025-02-19';
const TIMEOUT_MS = 3000;

const QUERY = `{
  "custom": *[_type == "customEvent" && defined(date) && date >= $today]{
    _id, title, date, time, venue, description, url, tags, recommended,
    "imageUrl": image.asset->url
  },
  "recs": *[_type == "recommendation" && defined(date) && date >= $today]{
    venue, date, titleContains
  }
}`;

export async function fetchEditorial(todayIso: string): Promise<EditorialContent | null> {
    const projectId = process.env.SANITY_PROJECT_ID;
    if (!projectId) return null;
    const dataset = process.env.SANITY_DATASET ?? 'production';
    const params = new URLSearchParams({ query: QUERY, $today: JSON.stringify(todayIso) });
    const url = `https://${projectId}.apicdn.sanity.io/${API_VERSION}/data/query/${dataset}?${params}`;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) {
            console.error(`[editorial] Sanity responded ${res.status}`);
            return null;
        }
        const body = await res.json();
        const result = body?.result;
        if (!result || !Array.isArray(result.custom) || !Array.isArray(result.recs)) {
            console.error('[editorial] unexpected Sanity response shape');
            return null;
        }
        return { custom: result.custom, recs: result.recs };
    } catch (err) {
        console.error('[editorial] Sanity fetch failed:', err instanceof Error ? err.message : err);
        return null;
    }
}
