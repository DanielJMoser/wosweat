export interface SiteSelectors {
    eventContainer: string;
    title: string;
    date?: string;
    time?: string;
    weekday?: string;
    description?: string;
    url: string;
    image?: string;
    price?: string;
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

    if (url.includes('brux.at')) {
        return {
            eventContainer: 'article.lp-item',
            title: '.lp-title',
            date: '.lp-date',
            description: '.lp-subtitle',
            url: '.lp-title-link',
            image: 'img',
            venue: 'BRUX Freies Theater Innsbruck'
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
            venue: 'LiveStage Tirol'
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
