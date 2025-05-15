import axios from "axios";
import * as cheerio from "cheerio";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { EventData } from "../../../shared/types/events";

/**
 * Scrape events from a given URL
 */
export async function scrapeEvents(url: string, useJsRendering = false): Promise<EventData[]> {
    if (useJsRendering) {
        return scrapeWithPuppeteer(url);
    } else {
        return scrapeWithCheerio(url);
    }
}

/**
 * Store events in the database/storage
 * Note: In a real implementation, this would connect to a database or storage service
 */
export async function storeEvents(events: EventData[]): Promise<void> {
    // This is a simplified implementation that would be replaced with actual storage logic
    // For example, using Netlify's built-in Key-Value store, DynamoDB, Fauna, etc.
    const storageData = {
        events,
        timestamp: new Date().toISOString()
    };

    // Store to a file in the /tmp directory (available in Netlify Functions)
    const fs = require('fs');
    const path = require('path');

    // In a real implementation, this would be replaced with a database write
    const tmpDir = '/tmp';
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    fs.writeFileSync(
        path.join(tmpDir, 'cached_events.json'),
        JSON.stringify(storageData),
        'utf8'
    );
}

/**
 * Retrieve stored events
 */
export async function getStoredEvents(): Promise<EventData[]> {
    // This is a simplified implementation that would be replaced with actual retrieval logic
    const fs = require('fs');
    const path = require('path');

    const filePath = path.join('/tmp', 'cached_events.json');

    if (!fs.existsSync(filePath)) {
        return [];
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return data.events || [];
    } catch (error) {
        console.error('Error reading cached events:', error);
        return [];
    }
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

        // Load HTML into Cheerio
        const $ = cheerio.load(html);
        const events: EventData[] = [];

        // Example selectors for treibhaus.at - adjust based on the target website's structure
        $('.program-event, .event-container').each((index, element) => {
            try {
                // Extract event details using Cheerio selectors
                const title = $(element).find('h2, h3, .title').text().trim();
                const dateText = $(element).find('.date, .event-date').text().trim();
                const description = $(element).find('.description, p').text().trim();
                const relativeUrl = $(element).find('a').attr('href') || '';
                const imageUrl = $(element).find('img').attr('src') || undefined;

                // Process the date - actual implementation would handle their specific format
                const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})?/);
                let date = dateText;

                if (dateMatch) {
                    const [_, day, month, year = new Date().getFullYear()] = dateMatch;
                    date = `${year}-${month}-${day}`;
                }

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Add to events array
                events.push({
                    id,
                    title,
                    date,
                    description,
                    url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                    venue: "Treibhaus Innsbruck",
                    imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
                });
            } catch (eventError) {
                console.warn(`Error parsing event at index ${index}:`, eventError);
                // Continue with next event
            }
        });

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

        // Navigate to the URL with a timeout to avoid serverless function timeout
        await page.goto(url, {
            waitUntil: "domcontentloaded", // Faster than networkidle0
            timeout: 8000, // 8-second timeout (Netlify functions have a 10s limit)
        });

        // Get the page content and use Cheerio to parse it (more efficient than page.evaluate)
        const content = await page.content();
        const $ = cheerio.load(content);

        const events: EventData[] = [];

        // Use the same parsing logic as in the Cheerio function
        $('.program-event, .event-container').each((index, element) => {
            try {
                const title = $(element).find('h2, h3, .title').text().trim();
                const dateText = $(element).find('.date, .event-date').text().trim();
                const description = $(element).find('.description, p').text().trim();
                const relativeUrl = $(element).find('a').attr('href') || '';
                const imageUrl = $(element).find('img').attr('src') || undefined;

                // Process the date
                const dateMatch = dateText.match(/(\d{2})\.(\d{2})\.(\d{4})?/);
                let date = dateText;

                if (dateMatch) {
                    const [_, day, month, year = new Date().getFullYear()] = dateMatch;
                    date = `${year}-${month}-${day}`;
                }

                // Generate ID
                const id = `event-${index}-${Date.now()}`;

                // Add to events array
                events.push({
                    id,
                    title,
                    date,
                    description,
                    url: relativeUrl ? new URL(relativeUrl, url).toString() : url,
                    venue: "Treibhaus Innsbruck",
                    imageUrl: imageUrl ? new URL(imageUrl, url).toString() : undefined,
                });
            } catch (eventError) {
                console.warn(`Error parsing event at index ${index}:`, eventError);
                // Continue with next event
            }
        });

        return events;
    } catch (error) {
        console.error("Error in Puppeteer scraper:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}