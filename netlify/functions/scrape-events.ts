import { Handler } from "@netlify/functions";
import { EventData, ScraperResponse } from "../../shared/types/events";
import { scrapeEvents } from "./utils/scraper-utils";

// Main handler function
export const handler: Handler = async (event) => {
    // Set CORS headers for browser access
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };

    // Handle OPTIONS request for CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers,
            body: ""
        };
    }

    try {
        // Allow specifying a URL via query parameter or use default
        const targetUrl = event.queryStringParameters?.url || "https://www.treibhaus.at/programm";

        // Determine if we need to use Puppeteer (for JavaScript rendering) or Cheerio is sufficient
        const useJsRendering = event.queryStringParameters?.js === "true" || false;

        let events: EventData[] = [];

        // Scrape the events using the appropriate method
        events = await scrapeEvents(targetUrl, useJsRendering);

        // Return the scraped events with caching headers
        return {
            statusCode: 200,
            headers: {
                ...headers,
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=600", // Cache for 10 minutes
            },
            body: JSON.stringify({
                success: true,
                events,
                count: events.length,
                timestamp: new Date().toISOString(),
            } as ScraperResponse),
        };
    } catch (error) {
        console.error("Error in scraper function:", error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : "Unknown error occurred",
            } as ScraperResponse),
        };
    }
};