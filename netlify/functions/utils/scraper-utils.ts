import axios from "axios";
import * as cheerio from "cheerio";
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
            'music-hall.at',
            'diebaeckerei.at'
        ];

        // Check if the current URL is in the jsRenderingSites array
        const needsJsRendering = useJsRendering || jsRenderingSites.some(site => url.includes(site));

        if (needsJsRendering) {
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
        return {
            eventContainer: '.product-list-item, .product, li',
            title: '.product-title, h2, .title',
            date: '.product-price, .date-info, .date', // Note: BigCartel might include date in title or description
            description: '.product-description, .description, p',
            url: 'a',
            image: '.product-image img, img',
            venue: 'Artillery Productions'
        };
    } else if (url.includes('music-hall.at')) {
        return {
            eventContainer: '.event-item, .dhvc-event, li.event, .event, .col-md-12',
            title: '.event-title, h3, .title',
            date: '.event-date, .date, time, .event-start-date',
            description: '.event-content, .description, .excerpt, p',
            url: 'a',
            image: '.event-image img, img',
            venue: 'Music Hall Innsbruck'
        };
    } else if (url.includes('diebaeckerei.at')) {
        return {
            eventContainer: '.event, .veranstaltung, article, .blog-post',
            title: '.title, h1, h2, h3, .post-title',
            date: '.date, time, .post-date, .event-date',
            description: '.content, .post-content, .description, p',
            url: 'a',
            image: 'img',
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
    console.log(`Attempting to extract date from: "${dateText}"`);

    // Clean the date text
    const cleanDateText = dateText.trim().replace(/\s+/g, ' ');

    // Try German format: DD.MM.YYYY
    const germanDateMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (germanDateMatch) {
        const [_, day, month, year = new Date().getFullYear()] = germanDateMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try abbreviated day format: Do. DD.MM.YYYY
    const abbrevDayMatch = cleanDateText.match(/([A-Za-zäöüÄÖÜ]{2})\.\s*(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
    if (abbrevDayMatch) {
        const [_, _day, day, month, year = new Date().getFullYear()] = abbrevDayMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // Try common date formats: DD. Month YYYY or DD.MM.
    // First, check for month names in German or English
    const monthNames = {
        'januar': '01', 'januar': '01', 'jänner': '01', 'january': '01', 'jan': '01',
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
        const month = monthNames[monthName.toLowerCase()];
        if (month) {
            return `${year}-${month}-${day.padStart(2, '0')}`;
        }
    }

    // Try to extract date from bigcartel style: typically in a title like "Event Name - 05.16.2025"
    const bigCartelMatch = cleanDateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (bigCartelMatch) {
        const [_, month, day, year] = bigCartelMatch;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // If no match found, return the original text
    return dateText;
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
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

        $(selectors.eventContainer).each((index, element) => {
            try {
                // Extract event details using Cheerio selectors
                const title = cleanText($(element).find(selectors.title).first().text());
                const dateText = cleanText($(element).find(selectors.date).first().text());
                const description = cleanText($(element).find(selectors.description).text());
                const relativeUrl = $(element).find(selectors.url).attr('href') || '';
                const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

                console.log(`Processing event ${index}: ${title.substring(0, 30)}...`);
                console.log(`  Date text: ${dateText}`);

                // Process the date using our enhanced date extraction function
                const date = extractDateFromText(dateText);
                console.log(`  Extracted date: ${date}`);

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Only add if we have at least a title and some date information
                if (title && (dateText || title.includes('-'))) { // Some sites include date in title with a dash
                    // For BigCartel, try to extract date from title if dateText is empty or just a price
                    let finalDate = date;
                    if (url.includes('bigcartel') && (!dateText || dateText.startsWith('$'))) {
                        const dashIndex = title.lastIndexOf('-');
                        if (dashIndex > 0) {
                            const possibleDate = extractDateFromText(title.substring(dashIndex + 1));
                            if (possibleDate !== title.substring(dashIndex + 1)) {
                                finalDate = possibleDate;
                                console.log(`  Extracted date from title: ${finalDate}`);
                            }
                        }
                    }

                    // Add to events array
                    events.push({
                        id,
                        title,
                        date: finalDate,
                        description,
                        url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                        venue: selectors.venue,
                        imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
                    });

                    console.log(`  Added event: ${title.substring(0, 30)}...`);
                } else {
                    console.log(`  Skipped event ${index}: Insufficient data (title: ${Boolean(title)}, date: ${Boolean(dateText)})`);
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
            if (['document', 'xhr', 'fetch'].includes(resourceType)) {
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

        // Wait for dynamic content to load for certain sites
        if (url.includes('music-hall.at')) {
            try {
                await page.waitForSelector('.event-item, .dhvc-event', { timeout: 3000 });
            } catch (e) {
                console.log('Timeout waiting for event elements, proceeding anyway');
            }
        } else if (url.includes('diebaeckerei.at')) {
            try {
                await page.waitForSelector('.event, .veranstaltung, article, .blog-post', { timeout: 3000 });
            } catch (e) {
                console.log('Timeout waiting for event elements, proceeding anyway');
            }
        }

        // Get the page content and use Cheerio to parse it (more efficient than page.evaluate)
        const content = await page.content();
        console.log(`Received page content (${content.length} bytes)`);

        const $ = cheerio.load(content);

        // Get the appropriate selectors for this site
        const selectors = getSelectorsForSite(url);
        console.log(`Using selectors for ${url}:`, selectors);

        const events: EventData[] = [];

        // Log how many potential event containers we found
        const containerCount = $(selectors.eventContainer).length;
        console.log(`Found ${containerCount} potential event containers`);

        // Use similar parsing logic as in the Cheerio function
        $(selectors.eventContainer).each((index, element) => {
            try {
                const title = cleanText($(element).find(selectors.title).first().text());
                const dateText = cleanText($(element).find(selectors.date).first().text());
                const description = cleanText($(element).find(selectors.description).text());
                const relativeUrl = $(element).find(selectors.url).attr('href') || '';
                const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

                console.log(`Processing event ${index}: ${title.substring(0, 30)}...`);
                console.log(`  Date text: ${dateText}`);

                // Process the date using our enhanced date extraction function
                const date = extractDateFromText(dateText);
                console.log(`  Extracted date: ${date}`);

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Only add if we have at least a title and some date information
                if (title && (dateText || title.includes('-'))) {
                    // For BigCartel, try to extract date from title if dateText is empty or just a price
                    let finalDate = date;
                    if (url.includes('bigcartel') && (!dateText || dateText.startsWith('$'))) {
                        const dashIndex = title.lastIndexOf('-');
                        if (dashIndex > 0) {
                            const possibleDate = extractDateFromText(title.substring(dashIndex + 1));
                            if (possibleDate !== title.substring(dashIndex + 1)) {
                                finalDate = possibleDate;
                                console.log(`  Extracted date from title: ${finalDate}`);
                            }
                        }
                    }

                    // Add to events array
                    events.push({
                        id,
                        title,
                        date: finalDate,
                        description,
                        url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                        venue: selectors.venue,
                        imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
                    });

                    console.log(`  Added event: ${title.substring(0, 30)}...`);
                } else {
                    console.log(`  Skipped event ${index}: Insufficient data (title: ${Boolean(title)}, date: ${Boolean(dateText)})`);
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