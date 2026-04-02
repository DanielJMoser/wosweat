import * as cheerio from 'cheerio';
import { EventData } from '@wosweat/shared/types/events';
import { extractDateFromText, cleanText } from '../date-parser';
import { SiteSelectors } from '../site-selectors';

export function extractGenericEvents($: cheerio.CheerioAPI, url: string, selectors: SiteSelectors): EventData[] {
    const events: EventData[] = [];

    $(selectors.eventContainer).each((index: number, element: any) => {
        try {
            const title = cleanText($(element).find(selectors.title).first().text());
            const dateText = cleanText($(element).find(selectors.date!).first().text());
            const description = cleanText($(element).find(selectors.description!).text());
            const relativeUrl = $(element).find(selectors.url).attr('href') || '';
            const imageUrl = $(element).find(selectors.image!).attr('src') || undefined;

            const date = extractDateFromText(dateText || title);

            if (!title || !date) return;

            events.push({
                id: `event-${index}-${Date.now()}`,
                title,
                date,
                description,
                url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                venue: selectors.venue,
                imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
            });
        } catch (error) {
            console.error(`Error parsing event at index ${index}:`, error);
        }
    });

    return events;
}
