import axios from "axios";
import * as cheerio from "cheerio";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { EventData } from "../../../shared/types/events";

export async function scrapeEvents(url: string, useJsRendering = false): Promise<EventData[]> {
    try {
        const jsRenderingSites = ['music-hall.at'];

        if (useJsRendering || jsRenderingSites.some(site => url.includes(site))) {
            return await scrapeWithPuppeteer(url);
        }

        return await scrapeWithCheerio(url);
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        throw error;
    }
}

export async function storeEvents(events: EventData[]): Promise<void> {
    try {
        const fs = require('fs');
        const path = require('path');

        const tmpDir = '/tmp';
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const filePath = path.join(tmpDir, 'cached_events.json');
        fs.writeFileSync(filePath, JSON.stringify({ events, timestamp: new Date().toISOString() }), 'utf8');
    } catch (error) {
        console.error('Error storing events:', error);
        throw error;
    }
}

export async function getStoredEvents(): Promise<EventData[]> {
    try {
        const fs = require('fs');
        const path = require('path');

        const filePath = path.join('/tmp', 'cached_events.json');
        if (!fs.existsSync(filePath)) return [];

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const cacheAgeMs = Date.now() - new Date(data.timestamp).getTime();

        if (cacheAgeMs > 5 * 60 * 1000) {
            fs.unlinkSync(filePath);
            return [];
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return (data.events || []).filter((event: any) => {
            try {
                const eventDate = new Date(event.date);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today;
            } catch {
                return false;
            }
        });
    } catch (error) {
        console.error('Error reading cached events:', error);
        return [];
    }
}

function getSelectorsForSite(url: string) {
    if (url.includes('treibhaus.at')) {
        return {
            eventContainer: '.program-entry, .program-event, .event-item, div.item, article, .event, .col-md-4',
            title: 'h1, h2, h3, h4, .title, .header, span.title, strong',
            date: '.date, .event-date, time, .datum, .date-display-single',
            description: '.description, .text, .content, p',
            url: 'a',
            image: 'img',
            venue: 'Treibhaus Innsbruck'
        };
    }

    if (url.includes('pmk.or.at')) {
        return {
            eventContainer: '.group\\/teaser',
            title: 'h2 a',
            date: 'p.text-lg, p.text-xl',
            description: 'p.md\\:text-lg',
            url: 'h2 a',
            image: 'img[loading="lazy"]',
            venue: 'PMK Innsbruck'
        };
    }

    if (url.includes('artilleryproductions.bigcartel.com')) {
        return {
            eventContainer: '.product',
            title: '.product_name, h4',
            price: 'h5',
            url: 'a',
            image: 'img',
            venue: 'Artillery Productions'
        };
    }

    if (url.includes('music-hall.at')) {
        return {
            eventContainer: '.event-list, .event-item, .dhvc-event, li.event, .event, article, .entry, .item',
            title: '.event-title, h3, .title',
            date: '.event-date, .date, time, .event-start-date',
            description: '.event-content, .description, .excerpt, p',
            url: 'a',
            image: '.event-image img, img',
            venue: 'Music Hall Innsbruck'
        };
    }

    if (url.includes('diebaeckerei.at')) {
        return {
            eventContainer: '.event-thumb',
            title: '.event-thumb__title',
            date: '.event-thumb__day',
            time: '.event-thumb__time',
            weekday: '.event-thumb__weekday',
            description: '.event-thumb__excerpt',
            url: '.event-thumb',
            image: '.event-thumb__img',
            recurringEventContainer: '.recurring-event__thumb',
            recurringTitle: '.recurring-event-thumb__title',
            recurringDate: '.recurring-event-thumb__day',
            recurringImage: '.recurring-event-thumb__img',
            venue: 'Die Bäckerei'
        };
    }

    return {
        eventContainer: 'article, .event, .veranstaltung, div[class*="event"], li',
        title: 'h1, h2, h3, h4, .title, .event-title',
        date: '.date, time, .event-date, .datetime',
        description: 'p, .description, .content, .text',
        url: 'a',
        image: 'img',
        venue: 'Unknown Venue'
    };
}

function extractDateFromText(dateText: string): string {
    if (!dateText) return '';

    const cleanDateText = dateText.trim().replace(/\s+/g, ' ');

    // DD.MM.YYYY (4-digit year)
    const fourDigitYearMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (fourDigitYearMatch) {
        const [_, day, month, year] = fourDigitYearMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // DD.MM.YY (2-digit year, anchored to avoid matching first 2 digits of a 4-digit year)
    const shortYearMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{2})(?:\s|$)/);
    if (shortYearMatch) {
        const [_, day, month, shortYear] = shortYearMatch;
        return `20${shortYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // DD.MM. (no year, defaults to current year)
    const noYearMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\./);
    if (noYearMatch) {
        const [_, day, month] = noYearMatch;
        return `${new Date().getFullYear()}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Abbreviated day prefix: Fr. 27.2.2026
    const abbrevDayMatch = cleanDateText.match(/[A-Za-zäöüÄÖÜ]{2,3}\.?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (abbrevDayMatch) {
        const [_, day, month, year = String(new Date().getFullYear())] = abbrevDayMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // DD. MonthName YYYY
    const monthNames: { [key: string]: string } = {
        'januar': '01', 'january': '01', 'jänner': '01', 'jan': '01',
        'februar': '02', 'february': '02', 'feb': '02',
        'märz': '03', 'march': '03', 'mar': '03',
        'april': '04', 'apr': '04',
        'mai': '05', 'may': '05',
        'juni': '06', 'june': '06', 'jun': '06',
        'juli': '07', 'july': '07', 'jul': '07',
        'august': '08', 'aug': '08',
        'september': '09', 'sep': '09', 'sept': '09',
        'oktober': '10', 'october': '10', 'okt': '10', 'oct': '10',
        'november': '11', 'nov': '11',
        'dezember': '12', 'december': '12', 'dez': '12', 'dec': '12'
    };

    const monthNameMatch = cleanDateText.toLowerCase().match(/(\d{1,2})\.?\s+([a-zäöü]+)\.?\s+(\d{4})/);
    if (monthNameMatch) {
        const [_, day, monthName, year] = monthNameMatch;
        const month = monthNames[monthName.toLowerCase()];
        if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
        }
    }

    if (/^\d{1,2}:\d{2}\s*(UHR|AM|PM)?$/i.test(cleanDateText)) return '';
    if (cleanDateText.length < 5 || /^\d{1,2}:\d{2}/.test(cleanDateText)) return '';

    return '';
}

function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function extractArtilleryEvents($: cheerio.CheerioAPI, url: string): EventData[] {
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

function extractBaeckereiEvents($: cheerio.CheerioAPI, url: string): EventData[] {
    const events: EventData[] = [];
    const selectors = getSelectorsForSite(url);

    $(selectors.eventContainer).each((index: number, element: any) => {
        try {
            const eventElement = $(element);
            const isCancelled = eventElement.hasClass('is-cancelled');
            const title = cleanText(eventElement.find(selectors.title).text());
            if (!title) return;

            const dayElem = eventElement.find(selectors.date);
            const dateText = cleanText(dayElem.text());
            let eventDate = dayElem.attr('datetime') || '';
            eventDate = eventDate ? extractDateFromText(eventDate) : extractDateFromText(dateText);

            const description = cleanText(eventElement.find(selectors.description).text());
            const eventUrl = eventElement.attr('href') || '';
            const fullUrl = eventUrl ? new URL(eventUrl, url).toString() : url;
            const imageUrl = eventElement.find(selectors.image).attr('src') || undefined;
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
            const title = cleanText(eventElement.find(selectors.recurringTitle).text());
            if (!title) return;

            const dateElem = eventElement.find(selectors.recurringDate);
            const dateText = cleanText(dateElem.text());
            let eventDate = dateElem.attr('datetime') || '';
            eventDate = eventDate ? extractDateFromText(eventDate) : extractDateFromText(dateText);

            const eventUrl = eventElement.attr('href') || '';
            const fullUrl = eventUrl ? new URL(eventUrl, url).toString() : url;
            const imageUrl = eventElement.find(selectors.recurringImage).attr('src') || undefined;
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

function extractGenericEvents($: cheerio.CheerioAPI, url: string, selectors: ReturnType<typeof getSelectorsForSite>): EventData[] {
    const events: EventData[] = [];

    $(selectors.eventContainer).each((index: number, element: any) => {
        try {
            const title = cleanText($(element).find(selectors.title).first().text());
            const dateText = cleanText($(element).find(selectors.date).first().text());
            const description = cleanText($(element).find(selectors.description).text());
            const relativeUrl = $(element).find(selectors.url).attr('href') || '';
            const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

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

async function scrapeWithCheerio(url: string): Promise<EventData[]> {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        if (url.includes('artilleryproductions.bigcartel.com')) {
            return extractArtilleryEvents($, url);
        }

        if (url.includes('diebaeckerei.at')) {
            return extractBaeckereiEvents($, url);
        }

        return extractGenericEvents($, url, getSelectorsForSite(url));
    } catch (error) {
        console.error("Error in Cheerio scraper:", error);
        throw error;
    }
}

async function scrapeWithPuppeteer(url: string): Promise<EventData[]> {
    let browser = null;

    try {
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--single-process',
                '--no-zygote'
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', request => {
            const resourceType = request.resourceType();
            if (['document', 'xhr', 'fetch', 'script'].includes(resourceType)) {
                request.continue();
            } else {
                request.abort();
            }
        });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        );

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 8000,
        });

        if (url.includes('music-hall.at')) {
            try {
                await page.waitForSelector('.event-list, .event-item, .dhvc-event, li.event, .event, article, .entry, .item', { timeout: 3000 });
            } catch {
                // Content may already be loaded
            }
        }

        const content = await page.content();
        const $ = cheerio.load(content);

        return extractGenericEvents($, url, getSelectorsForSite(url));
    } catch (error) {
        console.error("Error in Puppeteer scraper:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
