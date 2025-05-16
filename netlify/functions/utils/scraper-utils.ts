import axios from "axios";
import * as cheerio from "cheerio";
import { CheerioAPI } from "cheerio"; // Add this import for CheerioAPI type
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { EventData } from "../../../shared/types/events";

/**
 * Scrape events from a given URL
 */
export async function scrapeEvents(url: string, useJsRendering = false): Promise<EventData[]> {
    console.log(`Starting to scrape ${url} using ${useJsRendering ? 'Puppeteer' : 'Cheerio'}`);

    try {
        let events: EventData[];

        // Force JavaScript rendering for sites that require it
        const jsRenderingSites = [
            'music-hall.at'
        ];

        // Die Bäckerei needs JS rendering due to lazy loading and dynamic content
        if (url.includes('diebaeckerei.at')) {
            console.log('Using Puppeteer for diebaeckerei.at');
            events = await scrapeWithPuppeteer(url);
        }
        // Check if the current URL is in the jsRenderingSites array
        else if (useJsRendering || jsRenderingSites.some(site => url.includes(site))) {
            events = await scrapeWithPuppeteer(url);
        } else {
            events = await scrapeWithCheerio(url);
        }

        console.log(`Successfully scraped ${events.length} events from ${url}`);
        return events;
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        throw error;
    }
}

/**
 * Store events in the database/storage
 */
export async function storeEvents(events: EventData[]): Promise<void> {
    console.log(`Storing ${events.length} events`);

    try {
        // This is a simplified implementation that would be replaced with actual storage logic
        const storageData = {
            events,
            timestamp: new Date().toISOString()
        };

        // Store to a file in the /tmp directory (available in Netlify Functions)
        const fs = require('fs');
        const path = require('path');

        const tmpDir = '/tmp';
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        const filePath = path.join(tmpDir, 'cached_events.json');
        fs.writeFileSync(filePath, JSON.stringify(storageData), 'utf8');
        console.log(`Events successfully stored to ${filePath}`);
    } catch (error) {
        console.error('Error storing events:', error);
        throw error;
    }
}

/**
 * Retrieve stored events
 */
export async function getStoredEvents(): Promise<EventData[]> {
    console.log('Retrieving stored events');

    try {
        const fs = require('fs');
        const path = require('path');

        const filePath = path.join('/tmp', 'cached_events.json');

        if (!fs.existsSync(filePath)) {
            console.log('No cached events file found');
            return [];
        }

        const rawData = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawData);
        console.log(`Retrieved ${data.events?.length || 0} events from cache`);
        return data.events || [];
    } catch (error) {
        console.error('Error reading cached events:', error);
        return [];
    }
}

/**
 * Get correct selectors based on the URL
 */
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
    } else if (url.includes('pmk.or.at')) {
        return {
            eventContainer: '.event, .veranstaltung, article',
            title: 'h1, h2, h3, .title, .event-title',
            date: '.date, .event-date, time, .datum',
            description: '.description, .text, .content, p',
            url: 'a',
            image: 'img',
            venue: 'PMK Innsbruck'
        };
    } else if (url.includes('artilleryproductions.bigcartel.com')) {
        // Special case for BigCartel Artillery Productions
        return {
            eventContainer: '.product',
            title: '.product_name, h4',
            price: 'h5',
            url: 'a',
            image: 'img',
            venue: 'Artillery Productions'
        };
    } else if (url.includes('music-hall.at')) {
        return {
            eventContainer: '.event-list, .event-item, .dhvc-event, li.event, .event, article, .entry, .item',
            title: '.event-title, h3, .title',
            date: '.event-date, .date, time, .event-start-date',
            description: '.event-content, .description, .excerpt, p',
            url: 'a',
            image: '.event-image img, img',
            venue: 'Music Hall Innsbruck'
        };
    } else if (url.includes('diebaeckerei.at')) {
        // Die Bäckerei has both regular events and recurring events with different structures
        return {
            // Regular events
            eventContainer: '.event-thumb',
            title: '.event-thumb__title',
            date: '.event-thumb__day',
            time: '.event-thumb__time',
            weekday: '.event-thumb__weekday',
            description: '.event-thumb__excerpt',
            url: '.event-thumb',
            image: '.event-thumb__img',

            // Recurring events
            recurringEventContainer: '.recurring-event__thumb',
            recurringTitle: '.recurring-event-thumb__title',
            recurringDate: '.recurring-event-thumb__day',
            recurringImage: '.recurring-event-thumb__img',

            venue: 'Die Bäckerei'
        };
    }

    // Default selectors for unknown sites (more generic)
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

/**
 * Extract and normalize date information from various formats
 */
function extractDateFromText(dateText: string): string {
    if (!dateText) return '';

    console.log(`Attempting to extract date from: "${dateText}"`);

    // Clean the date text
    const cleanDateText = dateText.trim().replace(/\s+/g, ' ');

    // Try to extract date from a title with format "Event Name - DD.MM.YYYY"
    const dateAtEnd = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dateAtEnd) {
        const [_, day, month, year] = dateAtEnd;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Artillery Productions specific format "Event - DD.MM.YYYY"
    const artilleryDateMatch = cleanDateText.match(/.*?(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (artilleryDateMatch) {
        const [_, day, month, year] = artilleryDateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try German format: DD.MM.YYYY
    const germanDateMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (germanDateMatch) {
        const [_, day, month, year = new Date().getFullYear()] = germanDateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try abbreviated day format: Do. DD.MM.YYYY
    const abbrevDayMatch = cleanDateText.match(/([A-Za-zäöüÄÖÜ]{2,3})\.?\s*(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (abbrevDayMatch) {
        const [_, _day, day, month, year = new Date().getFullYear()] = abbrevDayMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try common date formats: DD. Month YYYY or DD.MM.
    // First, check for month names in German or English
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

    // Check for format: DD. MonthName YYYY
    const monthNameMatch = cleanDateText.toLowerCase().match(/(\d{1,2})\.?\s+([a-zäöü]+)\.?\s+(\d{4})/);
    if (monthNameMatch) {
        const [_, day, monthName, year] = monthNameMatch;
        const monthKey = monthName.toLowerCase();
        const month = monthNames[monthKey];
        if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
        }
    }

    // If no match found, return the original text
    return cleanDateText;
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract event data from Artillery Productions BigCartel site
 * Special handling for this site structure
 */
function extractArtilleryEvents($: CheerioAPI, url: string): EventData[] {
    console.log('Using specialized extraction for Artillery Productions');
    const events: EventData[] = [];

    // Find each product
    $('.product').each((index: number, element: cheerio.Element) => {
        try {
            const productElement = $(element);

            // Extract the title which contains the event details
            const title = cleanText(productElement.find('.product_name, h4').text());

            if (!title) {
                console.log(`Skipping product ${index}: No title found`);
                return; // Skip this item
            }

            console.log(`Processing event ${index}: ${title}`);

            // Artillery products have dates embedded in the title
            // Format is typically "EVENT NAME - DD.MM.YYYY"
            let eventDate = '';
            let finalTitle = title;

            // Try to extract date from the title
            const dateInTitle = title.match(/.*?(\d{1,2})\.(\d{1,2})\.(\d{4})/);
            if (dateInTitle) {
                const [_, day, month, year] = dateInTitle;
                eventDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                console.log(`  Extracted date: ${eventDate}`);
            }

            // Get price as additional info
            const price = cleanText(productElement.find('h5').text());

            // Get URL and image
            const productUrl = $(element).find('a').attr('href') || '';
            const fullUrl = productUrl ? new URL(productUrl, url).toString() : url;

            const imageUrl = $(element).find('img').attr('src') || undefined;
            const fullImageUrl = imageUrl ? new URL(imageUrl, url).toString() : undefined;

            // Generate ID
            const id = `event-${index}-${Date.now()}`;

            // Add to events array
            events.push({
                id,
                title: finalTitle,
                date: eventDate,
                description: price ? `Price: ${price}` : '',
                url: fullUrl,
                venue: 'Artillery Productions',
                imageUrl: fullImageUrl,
            });

            console.log(`  Added event: ${finalTitle}`);
        } catch (error) {
            console.warn(`Error parsing Artillery event at index ${index}:`, error);
        }
    });

    return events;
}

/**
 * Extract events from Die Bäckerei site
 * Handles both regular and recurring events with different structures
 */
function extractBaeckereiEvents($: CheerioAPI, url: string): EventData[] {
    console.log('Using specialized extraction for Die Bäckerei');
    const events: EventData[] = [];

    // Get selectors for Die Bäckerei
    const selectors = getSelectorsForSite(url);

    // 1. Process regular events
    console.log('Processing regular events');
    $(selectors.eventContainer).each((index: number, element: cheerio.Element) => {
        try {
            const eventElement = $(element);

            // Check if event is cancelled
            const isCancelled = eventElement.hasClass('is-cancelled');

            // Extract the title
            const title = cleanText(eventElement.find(selectors.title).text());

            if (!title) {
                console.log(`Skipping event ${index}: No title found`);
                return; // Skip this item
            }

            console.log(`Processing event ${index}: ${title}`);

            // Extract date components
            const dayElem = eventElement.find(selectors.date);
            const timeElem = eventElement.find(selectors.time);
            const weekdayElem = eventElement.find(selectors.weekday);

            // Get the date string and clean it
            const dateText = cleanText(dayElem.text());
            const timeText = cleanText(timeElem.text());
            const weekdayText = cleanText(weekdayElem.text());

            console.log(`  Date components: ${weekdayText} ${dateText} ${timeText}`);

            // Try to get date from datetime attribute first (most reliable)
            let eventDate = dayElem.attr('datetime') || '';

            // If no datetime attribute, try to extract from text
            if (!eventDate) {
                eventDate = extractDateFromText(dateText);
            } else {
                // Process the datetime attribute to standard format
                eventDate = extractDateFromText(eventDate);
            }

            console.log(`  Extracted date: ${eventDate}`);

            // Get description
            const description = cleanText(eventElement.find(selectors.description).text());

            // Get URL and image
            const eventUrl = eventElement.attr('href') || '';
            const fullUrl = eventUrl ? new URL(eventUrl, url).toString() : url;

            const imageUrl = eventElement.find(selectors.image).attr('src') || undefined;
            const fullImageUrl = imageUrl ? new URL(imageUrl, url).toString() : undefined;

            // Get tags if available
            const tagsElements = eventElement.find('.b-tag');
            const tags: string[] = [];
            tagsElements.each((_, tagElement) => {
                const tagText = cleanText($(tagElement).text());
                if (tagText) tags.push(tagText);
            });

            // Create event description with tags and cancellation status
            let fullDescription = description;
            if (tags.length > 0) {
                fullDescription += `\n\nCategories: ${tags.join(', ')}`;
            }

            if (isCancelled) {
                fullDescription = `[CANCELLED] ${fullDescription}`;
            }

            // Generate ID
            const id = `event-${index}-${Date.now()}`;

            // Add to events array
            events.push({
                id,
                title: isCancelled ? `[CANCELLED] ${title}` : title,
                date: eventDate,
                description: fullDescription,
                url: fullUrl,
                venue: selectors.venue,
                imageUrl: fullImageUrl,
            });

            console.log(`  Added event: ${title}`);
        } catch (error) {
            console.warn(`Error parsing Die Bäckerei event at index ${index}:`, error);
        }
    });

    // 2. Process recurring events
    console.log('Processing recurring events');
    $(selectors.recurringEventContainer).each((index: number, element: cheerio.Element) => {
        try {
            const eventElement = $(element);

            // Extract the title
            const title = cleanText(eventElement.find(selectors.recurringTitle).text());

            if (!title) {
                console.log(`Skipping recurring event ${index}: No title found`);
                return; // Skip this item
            }

            console.log(`Processing recurring event ${index}: ${title}`);

            // Extract date
            const dateElem = eventElement.find(selectors.recurringDate);

            // Get the date string
            const dateText = cleanText(dateElem.text());
            console.log(`  Date text: ${dateText}`);

            // Try to get date from datetime attribute first
            let eventDate = dateElem.attr('datetime') || '';

            // If no datetime attribute, try to extract from text
            if (!eventDate) {
                eventDate = extractDateFromText(dateText);
            } else {
                // Process the datetime attribute to standard format
                eventDate = extractDateFromText(eventDate);
            }

            console.log(`  Extracted date: ${eventDate}`);

            // Get URL and image
            const eventUrl = eventElement.attr('href') || '';
            const fullUrl = eventUrl ? new URL(eventUrl, url).toString() : url;

            const imageUrl = eventElement.find(selectors.recurringImage).attr('src') || undefined;
            const fullImageUrl = imageUrl ? new URL(imageUrl, url).toString() : undefined;

            // Generate ID
            const id = `recurring-event-${index}-${Date.now()}`;

            // Add to events array
            events.push({
                id,
                title: `[Recurring] ${title}`,
                date: eventDate,
                description: `This is a recurring event at Die Bäckerei. Time: ${dateText}`,
                url: fullUrl,
                venue: selectors.venue,
                imageUrl: fullImageUrl,
            });

            console.log(`  Added recurring event: ${title}`);
        } catch (error) {
            console.warn(`Error parsing Die Bäckerei recurring event at index ${index}:`, error);
        }
    });

    return events;
}

/**
 * Scrape event data using Cheerio (for static HTML content)
 */
async function scrapeWithCheerio(url: string): Promise<EventData[]> {
    try {
        console.log(`Fetching ${url} with Cheerio`);

        // Fetch HTML content
        const response = await axios.get(url);
        const html = response.data;
        console.log(`Received HTML response (${html.length} bytes)`);

        // Load HTML into Cheerio
        const $ = cheerio.load(html);

        // Special case for Artillery Productions BigCartel
        if (url.includes('artilleryproductions.bigcartel.com')) {
            return extractArtilleryEvents($, url);
        }

        // Special case for Die Bäckerei
        if (url.includes('diebaeckerei.at')) {
            return extractBaeckereiEvents($, url);
        }

        const events: EventData[] = [];

        // Get the appropriate selectors for this site
        const selectors = getSelectorsForSite(url);
        console.log(`Using selectors for ${url}:`, selectors);

        // Log how many potential event containers we found
        const containerCount = $(selectors.eventContainer).length;
        console.log(`Found ${containerCount} potential event containers`);

        // Analyze the DOM structure if no containers found
        if (containerCount === 0) {
            console.log("DOM Analysis for debugging:");
            // Log some common container patterns
            console.log(`- Elements with 'event' in class: ${$('[class*="event"]').length}`);
            console.log(`- Articles: ${$('article').length}`);
            console.log(`- List items: ${$('li').length}`);
            console.log(`- Divs with 'item' class: ${$('.item').length}`);
            console.log(`- Divs with grid classes: ${$('.col-md-4, .col-sm-6, .col-lg-3').length}`);
        }

        $(selectors.eventContainer).each((index: number, element: cheerio.Element) => {
            try {
                // Extract event details using Cheerio selectors
                const title = cleanText($(element).find(selectors.title).first().text());
                const dateText = cleanText($(element).find(selectors.date).first().text());
                const description = cleanText($(element).find(selectors.description).text());
                const relativeUrl = $(element).find(selectors.url).attr('href') || '';
                const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

                console.log(`Processing event ${index}: ${title}`);
                console.log(`  Date text: ${dateText}`);

                // Process the date using our enhanced date extraction function
                const date = extractDateFromText(dateText || title); // Try to extract from title if dateText is empty
                console.log(`  Extracted date: ${date}`);

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Check if we have enough info to add this event
                const hasDate = date && date !== dateText && date !== title;

                if (title && (hasDate || dateText)) {
                    // Add to events array
                    events.push({
                        id,
                        title,
                        date: hasDate ? date : dateText,
                        description,
                        url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                        venue: selectors.venue,
                        imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
                    });

                    console.log(`  Added event: ${title}`);
                } else {
                    console.log(`  Skipped event ${index}: Insufficient data (title: ${Boolean(title)}, date: ${hasDate || Boolean(dateText)})`);
                }
            } catch (eventError) {
                console.warn(`Error parsing event at index ${index}:`, eventError);
                // Continue with next event
            }
        });

        console.log(`Successfully extracted ${events.length} events from ${url}`);
        return events;
    } catch (error) {
        console.error("Error in Cheerio scraper:", error);
        throw error;
    }
}

/**
 * Scrape event data using Puppeteer (for dynamic JavaScript content)
 */
async function scrapeWithPuppeteer(url: string): Promise<EventData[]> {
    let browser = null;

    try {
        console.log(`Fetching ${url} with Puppeteer`);

        // Launch Puppeteer with optimized settings for serverless
        browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--single-process', // More efficient for serverless
                '--no-zygote'        // Improves startup time
            ],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        console.log('Puppeteer browser launched successfully');

        // Open a new page
        const page = await browser.newPage();

        // Block unnecessary resources to improve performance
        await page.setRequestInterception(true);
        page.on('request', request => {
            const resourceType = request.resourceType();
            if (['document', 'xhr', 'fetch', 'script'].includes(resourceType)) {
                request.continue();
            } else {
                request.abort();
            }
        });

        // Set user agent to avoid detection
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
        );

        console.log(`Navigating to ${url}`);

        // Navigate to the URL with a timeout to avoid serverless function timeout
        await page.goto(url, {
            waitUntil: "domcontentloaded", // Faster than networkidle0
            timeout: 8000, // 8-second timeout (Netlify functions have a 10s limit)
        });

        console.log('Page loaded successfully');

        // Site-specific waits and preparation
        if (url.includes('diebaeckerei.at')) {
            console.log('Waiting for Die Bäckerei content to load...');
            try {
                // Wait for events to load
                await Promise.race([
                    page.waitForSelector('.event-thumb', { timeout: 5000 }),
                    page.waitForSelector('.recurring-event__thumb', { timeout: 5000 })
                ]);

                // Scroll down to load more content (helps with lazy loading)
                await autoScroll(page);

                console.log('Content loaded for Die Bäckerei');
            } catch (e) {
                console.log('Timeout waiting for Die Bäckerei events, proceeding anyway');
            }
        } else if (url.includes('music-hall.at')) {
            try {
                await page.waitForSelector('.event-list, .event-item, .dhvc-event, li.event, .event, article, .entry, .item', { timeout: 3000 });
            } catch (e) {
                console.log('Timeout waiting for event elements, proceeding anyway');
            }
        }

        // Get the page content and use Cheerio to parse it
        const content = await page.content();
        console.log(`Received page content (${content.length} bytes)`);

        const $ = cheerio.load(content);

        // Special case for Artillery Productions BigCartel
        if (url.includes('artilleryproductions.bigcartel.com')) {
            return extractArtilleryEvents($, url);
        }

        // Special case for Die Bäckerei
        if (url.includes('diebaeckerei.at')) {
            return extractBaeckereiEvents($, url);
        }

        // Get the appropriate selectors for this site
        const selectors = getSelectorsForSite(url);
        console.log(`Using selectors for ${url}:`, selectors);

        const events: EventData[] = [];

        // Log how many potential event containers we found
        const containerCount = $(selectors.eventContainer).length;
        console.log(`Found ${containerCount} potential event containers`);

        // Analyze the DOM structure if no containers found
        if (containerCount === 0) {
            console.log("DOM Analysis for debugging:");
            // Log some common container patterns
            console.log(`- Elements with 'event' in class: ${$('[class*="event"]').length}`);
            console.log(`- Articles: ${$('article').length}`);
            console.log(`- List items: ${$('li').length}`);
            console.log(`- Divs with 'item' class: ${$('.item').length}`);
            console.log(`- Divs with grid classes: ${$('.col-md-4, .col-sm-6, .col-lg-3').length}`);

            // Try to look for the most common elements that might contain events
            const commonElements = [
                '.col-md-12', '.col-lg-12', '.col-md-6', '.col-lg-6',
                '.col-md-4', '.col-lg-4', '.col-sm-6', '.item', '.entry',
                'article', 'li'
            ];

            for (const selector of commonElements) {
                const count = $(selector).length;
                if (count > 0) {
                    console.log(`Found ${count} elements matching '${selector}'`);
                    console.log(`First element text: ${$(selector).first().text().substring(0, 100)}...`);
                }
            }
        }

        // Use similar parsing logic as in the Cheerio function
        $(selectors.eventContainer).each((index: number, element: cheerio.Element) => {
            try {
                const title = cleanText($(element).find(selectors.title).first().text());
                const dateText = cleanText($(element).find(selectors.date).first().text());
                const description = cleanText($(element).find(selectors.description).text());
                const relativeUrl = $(element).find(selectors.url).attr('href') || '';
                const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

                console.log(`Processing event ${index}: ${title}`);
                console.log(`  Date text: ${dateText}`);

                // Process the date using our enhanced date extraction function
                const date = extractDateFromText(dateText || title); // Try to extract from title if dateText is empty
                console.log(`  Extracted date: ${date}`);

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Check if we have enough info to add this event
                const hasDate = date && date !== dateText && date !== title;

                if (title && (hasDate || dateText)) {
                    // Add to events array
                    events.push({
                        id,
                        title,
                        date: hasDate ? date : dateText,
                        description,
                        url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                        venue: selectors.venue,
                        imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
                    });

                    console.log(`  Added event: ${title}`);
                } else {
                    console.log(`  Skipped event ${index}: Insufficient data (title: ${Boolean(title)}, date: ${hasDate || Boolean(dateText)})`);
                }
            } catch (eventError) {
                console.warn(`Error parsing event at index ${index}:`, eventError);
                // Continue with next event
            }
        });

        console.log(`Successfully extracted ${events.length} events from ${url}`);
        return events;
    } catch (error) {
        console.error("Error in Puppeteer scraper:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('Puppeteer browser closed');
        }
    }
}

/**
 * Auto-scroll function to load lazy-loaded content
 */
async function autoScroll(page: puppeteer.Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}