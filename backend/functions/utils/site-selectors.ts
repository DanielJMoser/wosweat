import { VENUES } from '@wosweat/shared/constants';

export interface SiteSelectors {
    eventContainer: string;
    title: string;
    date?: string;
    description?: string;
    url: string;
    image?: string;
    venue: string;
    recurringEventContainer?: string;
    recurringTitle?: string;
    recurringDate?: string;
    recurringImage?: string;
}

export function getSelectorsForSite(url: string): SiteSelectors {
    if (url.includes('treibhaus.at')) {
        return {
            eventContainer: '.program-entry, .program-event, .event-item, div.item, article, .event, .col-md-4',
            title: 'h1, h2, h3, h4, .title, .header, span.title, strong',
            date: '.date, .event-date, time, .datum, .date-display-single',
            description: '.description, .text, .content, p',
            url: 'a',
            image: 'img',
            venue: VENUES.treibhaus
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
            venue: VENUES.pmk
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
            venue: VENUES.musicHall
        };
    }

    if (url.includes('diebaeckerei.at')) {
        return {
            eventContainer: '.event-thumb',
            title: '.event-thumb__title',
            date: '.event-thumb__day',
            description: '.event-thumb__excerpt',
            url: '.event-thumb',
            image: '.event-thumb__img',
            recurringEventContainer: '.recurring-event__thumb',
            recurringTitle: '.recurring-event-thumb__title',
            recurringDate: '.recurring-event-thumb__day',
            recurringImage: '.recurring-event-thumb__img',
            venue: VENUES.baeckerei
        };
    }

    if (url.includes('brux.at')) {
        return {
            eventContainer: 'article.lp-item',
            title: '.lp-title',
            date: '.lp-date',
            description: '.lp-subtitle',
            url: '.lp-title-link',
            image: 'img',
            venue: VENUES.brux
        };
    }

    if (url.includes('livestage-tirol.com')) {
        return {
            eventContainer: '.ww_news-list-item',
            title: 'h3',
            date: '.ww_news-list-item_date-date',
            description: '.text-secondary.text-uppercase',
            url: 'h3 a',
            image: 'img',
            venue: VENUES.livestage
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
