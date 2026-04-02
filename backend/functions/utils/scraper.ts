import axios from 'axios';
import * as cheerio from 'cheerio';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { EventData } from '@wosweat/shared/types/events';
import { getSelectorsForSite } from './site-selectors';
import { extractArtilleryEvents } from './extractors/artillery';
import { extractBaeckereiEvents } from './extractors/baeckerei';
import { extractKellertheaterEvents } from './extractors/kellertheater';
import { extractGenericEvents } from './extractors/generic';

const JS_RENDERING_SITES = ['music-hall.at'];

export async function scrapeEvents(url: string, useJsRendering = false): Promise<EventData[]> {
    try {
        if (useJsRendering || JS_RENDERING_SITES.some(site => url.includes(site))) {
            return await scrapeWithPuppeteer(url);
        }
        return await scrapeWithCheerio(url);
    } catch (error) {
        console.error(`Failed to scrape ${url}:`, error);
        throw error;
    }
}

async function scrapeWithCheerio(url: string): Promise<EventData[]> {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    if (url.includes('artilleryproductions.bigcartel.com')) {
        return extractArtilleryEvents($, url);
    }
    if (url.includes('diebaeckerei.at')) {
        return extractBaeckereiEvents($, url);
    }
    if (url.includes('kellertheater.at')) {
        return extractKellertheaterEvents($, url);
    }

    return extractGenericEvents($, url, getSelectorsForSite(url));
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
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
        );

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 8000,
        });

        if (url.includes('music-hall.at')) {
            try {
                await page.waitForSelector(
                    '.event-list, .event-item, .dhvc-event, li.event, .event, article, .entry, .item',
                    { timeout: 3000 }
                );
            } catch {
                // Content may already be loaded
            }
        }

        const content = await page.content();
        const $ = cheerio.load(content);

        return extractGenericEvents($, url, getSelectorsForSite(url));
    } catch (error) {
        console.error('Error in Puppeteer scraper:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
