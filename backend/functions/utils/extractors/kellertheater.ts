import * as cheerio from 'cheerio';
import { EventData } from '@wosweat/shared/types/events';
import { cleanText } from '../date-parser';

export function extractKellertheaterEvents($: cheerio.CheerioAPI, url: string): EventData[] {
    const events: EventData[] = [];

    $('.dayacts article').each((index: number, element: any) => {
        try {
            const article = $(element);
            const jsonLdScript = article.find('script[type="application/ld+json"]').html();
            if (!jsonLdScript) return;

            const jsonLd = JSON.parse(jsonLdScript);
            const startDate = jsonLd.startDate;
            const eventDate = startDate ? startDate.split('T')[0] : '';
            if (!eventDate) return;

            const title = jsonLd.name || cleanText(article.find('h4').text());
            if (!title) return;

            const description = cleanText(article.find('.text p').text());
            const eventUrl = jsonLd.url || '';
            const imageUrl = jsonLd.image || article.find('img').attr('src') || undefined;

            events.push({
                id: `event-${index}-${Date.now()}`,
                title,
                date: eventDate,
                description,
                url: eventUrl || url,
                venue: 'Innsbrucker Kellertheater',
                imageUrl,
            });
        } catch (error) {
            console.error(`Error parsing Kellertheater event at index ${index}:`, error);
        }
    });

    return events;
}
