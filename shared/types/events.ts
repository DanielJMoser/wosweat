export interface EventData {
    id: string;
    title: string;
    date: string;
    time?: string;
    description: string;
    url: string;
    venue?: string;
    imageUrl?: string;
    tags?: string[];
}

export interface ScraperResponse {
    success: boolean;
    events?: EventData[];
    error?: string;
    count?: number;
    timestamp?: string;
}