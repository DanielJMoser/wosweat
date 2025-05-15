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

        if (useJsRendering) {
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

        // Example selectors for treibhaus.at - adjust based on the target website's structure
        $(selectors.eventContainer).each((index, element) => {
            try {
                // Extract event details using Cheerio selectors
                const title = $(element).find(selectors.title).first().text().trim();
                const dateText = $(element).find(selectors.date).first().text().trim();
                const description = $(element).find(selectors.description).text().trim();
                const relativeUrl = $(element).find(selectors.url).attr('href') || '';
                const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

                console.log(`Processing event ${index}: ${title.substring(0, 30)}...`);
                console.log(`  Date text: ${dateText}`);

                // Process the date - try multiple formats
                let date = dateText;
                // Try German format: DD.MM.YYYY
                const germanDateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
                if (germanDateMatch) {
                    const [_, day, month, year = new Date().getFullYear()] = germanDateMatch;
                    date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }

                // Try abbreviated day format: Do. DD.MM.YYYY
                const abbrevDayMatch = dateText.match(/([A-Za-zäöüÄÖÜ]{2})\.\s*(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
                if (abbrevDayMatch) {
                    const [_, _day, day, month, year = new Date().getFullYear()] = abbrevDayMatch;
                    date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Only add if we have at least a title and some date information
                if (title && dateText) {
                    // Add to events array
                    events.push({
                        id,
                        title,
                        date,
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

        // Use the same parsing logic as in the Cheerio function
        $(selectors.eventContainer).each((index, element) => {
            try {
                const title = $(element).find(selectors.title).first().text().trim();
                const dateText = $(element).find(selectors.date).first().text().trim();
                const description = $(element).find(selectors.description).text().trim();
                const relativeUrl = $(element).find(selectors.url).attr('href') || '';
                const imageUrl = $(element).find(selectors.image).attr('src') || undefined;

                console.log(`Processing event ${index}: ${title.substring(0, 30)}...`);
                console.log(`  Date text: ${dateText}`);

                // Process the date - try multiple formats
                let date = dateText;
                // Try German format: DD.MM.YYYY
                const germanDateMatch = dateText.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})?/);
                if (germanDateMatch) {
                    const [_, day, month, year = new Date().getFullYear()] = germanDateMatch;
                    date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                }

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Only add if we have at least a title and some date information
                if (title && dateText) {
                    // Add to events array
                    events.push({
                        id,
                        title,
                        date,
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