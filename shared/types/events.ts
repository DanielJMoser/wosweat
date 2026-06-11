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
