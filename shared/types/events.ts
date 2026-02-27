export interface EventData {
    id: string;
    title: string;
    date: string;
    description: string;
    url: string;
    venue?: string;
    imageUrl?: string;
}

export interface ScraperResponse {
    success: boolean;
    events?: EventData[];
    error?: string;
    count?: number;
    timestamp?: string;
}