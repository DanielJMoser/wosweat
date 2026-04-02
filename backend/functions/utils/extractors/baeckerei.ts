import * as cheerio from 'cheerio';
import { EventData } from '@wosweat/shared/types/events';
import { extractDateFromText, cleanText } from '../date-parser';
import { getSelectorsForSite } from '../site-selectors';

export function extractBaeckereiEvents($: cheerio.CheerioAPI, url: string): EventData[] {
    const events: EventData[] = [];
    const selectors = getSelectorsForSite(url);

    $(selectors.eventContainer).each((index: number, element: any) => {
        try {
            const eventElement = $(element);
            const isCancelled = eventElement.hasClass('is-cancelled');
            const title = cleanText(eventElement.find(selectors.title).text());
            if (!title) return;

            const dayElem = eventElement.find(selectors.date!);
            const dateText = cleanText(dayElem.text());
            let eventDate = dayElem.attr('datetime') || '';
            eventDate = eventDate ? extractDateFromText(eventDate) : extractDateFromText(dateText);

            const description = cleanText(eventElement.find(selectors.description!).text());
            const eventUrl = eventElement.attr('href') || '';
            const fullUrl = eventUrl ? new URL(eventUrl, url).toString() : url;
            const imageUrl = eventElement.find(selectors.image!).attr('src') || undefined;
            const fullImageUrl = imageUrl ? new URL(imageUrl, url).toString() : undefined;

            const tags: string[] = [];
            eventElement.find('.b-tag').each((_: number, tagElement: any) => {
                const tagText = cleanText($(tagElement).text());
                if (tagText) tags.push(tagText);
            });

            let fullDescription = description;
            if (tags.length > 0) fullDescription += `\n\nCategories: ${tags.join(', ')}`;
            if (isCancelled) fullDescription = `[CANCELLED] ${fullDescription}`;

            events.push({
                id: `event-${index}-${Date.now()}`,
                title: isCancelled ? `[CANCELLED] ${title}` : title,
                date: eventDate,
                description: fullDescription,
                url: fullUrl,
                venue: selectors.venue,
                imageUrl: fullImageUrl,
            });
        } catch (error) {
            console.error(`Error parsing Die Bäckerei event at index ${index}:`, error);
        }
    });

    $(selectors.recurringEventContainer).each((index: number, element: any) => {
        try {
            const eventElement = $(element);
            const title = cleanText(eventElement.find(selectors.recurringTitle!).text());
            if (!title) return;

            const dateElem = eventElement.find(selectors.recurringDate!);
            const dateText = cleanText(dateElem.text());
            let eventDate = dateElem.attr('datetime') || '';
            eventDate = eventDate ? extractDateFromText(eventDate) : extractDateFromText(dateText);

            const eventUrl = eventElement.attr('href') || '';
            const fullUrl = eventUrl ? new URL(eventUrl, url).toString() : url;
            const imageUrl = eventElement.find(selectors.recurringImage!).attr('src') || undefined;
            const fullImageUrl = imageUrl ? new URL(imageUrl, url).toString() : undefined;

            events.push({
                id: `recurring-event-${index}-${Date.now()}`,
                title: `[Recurring] ${title}`,
                date: eventDate,
                description: `This is a recurring event at Die Bäckerei. Time: ${dateText}`,
                url: fullUrl,
                venue: selectors.venue,
                imageUrl: fullImageUrl,
            });
        } catch (error) {
            console.error(`Error parsing Die Bäckerei recurring event at index ${index}:`, error);
        }
    });

    return events;
}
