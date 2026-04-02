import * as cheerio from 'cheerio';
import { EventData } from '@wosweat/shared/types/events';
import { cleanText } from '../date-parser';

export function extractArtilleryEvents($: cheerio.CheerioAPI, url: string): EventData[] {
    const events: EventData[] = [];

    $('.product').each((index: number, element: any) => {
        try {
            const productElement = $(element);
            const title = cleanText(productElement.find('.product_name, h4').text());
            if (!title) return;

            let eventDate = '';
            const dateInTitle = title.match(/.*?(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (dateInTitle) {
                const [_, day, month, year] = dateInTitle;
                eventDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }

            const price = cleanText(productElement.find('h5').text());
            const productUrl = $(element).find('a').attr('href') || '';
            const fullUrl = productUrl ? new URL(productUrl, url).toString() : url;
            const imageUrl = $(element).find('img').attr('src') || undefined;
            const fullImageUrl = imageUrl ? new URL(imageUrl, url).toString() : undefined;

            events.push({
                id: `event-${index}-${Date.now()}`,
                title,
                date: eventDate,
                description: price ? `Price: ${price}` : '',
                url: fullUrl,
                venue: 'Artillery Productions',
                imageUrl: fullImageUrl,
            });
        } catch (error) {
            console.error(`Error parsing Artillery event at index ${index}:`, error);
        }
    });

    return events;
}
