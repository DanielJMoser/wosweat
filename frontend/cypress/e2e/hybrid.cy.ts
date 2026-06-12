const iso = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mkEvents = () => [
  { id: 'e1', title: 'Molchat Doma', date: iso(0), description: 'x', url: 'https://example.com/1', venue: 'PMK Innsbruck' },
  { id: 'e2', title: 'Jazz Trio', date: iso(0), description: 'x', url: 'https://example.com/2', venue: 'Treibhaus Innsbruck', time: '20:30' },
  { id: 'e3', title: 'Der Revisor', date: iso(0), description: 'x', url: 'https://example.com/3', venue: 'Innsbrucker Kellertheater' },
  { id: 'e4', title: 'DnB Bunker', date: iso(1), description: 'x', url: 'https://example.com/4', venue: 'Music Hall Innsbruck' },
];

beforeEach(() => {
  cy.intercept('GET', '/api/get-events', {
    body: { events: mkEvents(), lastUpdated: new Date().toISOString(), count: 4 },
  });
});

describe('hybrid ui — desktop', () => {
  beforeEach(() => cy.viewport(1280, 900));

  it('defaults to list view; cards choice persists across reload', () => {
    cy.visit('/');
    cy.get('.event-list__row').should('have.length', 3);
    cy.contains('button', 'KARTEN').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('.event-card').should('have.length', 3);
    cy.reload();
    cy.get('.event-card').should('have.length', 3);
  });

  it('list rows are keyboard-activatable', () => {
    cy.visit('/');
    cy.window().then(win => cy.stub(win, 'open').as('open'));
    cy.get('.event-list__row').first().focus().type('{enter}');
    cy.get('@open').should('have.been.calledWithMatch', 'https://example.com/');
  });

  it('venue chips filter and expose pressed state', () => {
    cy.visit('/');
    cy.contains('button', 'Alle').should('have.attr', 'aria-pressed', 'true');
    cy.contains('.view-controls__chip', 'PMK').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('.event-list__row').should('have.length', 1);
  });

  it('console view runs queries, commands, and suggestions', () => {
    cy.visit('/');
    cy.contains('button', 'KONSOLE').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('.console').should('be.visible');
    cy.get('[aria-label="WQL-Abfrage"]').type('SELECT * FROM events{enter}');
    cy.get('.console__ok').last().should('contain', 'events (');
    cy.get('[aria-label="WQL-Abfrage"]').type('help{enter}');
    cy.get('.console__line').should('contain', 'EXPORT ICS');
    cy.get('[aria-label="WQL-Abfrage"]').type('SELECT * FROM ');
    cy.get('.console__suggest').contains('button', 'events').click();
    cy.get('[aria-label="WQL-Abfrage"]').should('have.value', 'SELECT * FROM events ');
    cy.get('[aria-label="WQL-Abfrage"]').clear().type('clear{enter}');
    cy.get('.console__ok').should('not.exist');
  });

  it('month grid opens fully without clipping', () => {
    cy.visit('/');
    cy.get('[aria-label="Monatsansicht umschalten"]').click();
    cy.get('.month-grid__cells').should($cells => {
      const rect = $cells[0].getBoundingClientRect();
      const panel = $cells[0].closest('.month-grid')!.getBoundingClientRect();
      expect(rect.bottom, 'calendar fits inside the open panel').to.be.lte(panel.bottom + 1);
    });
    cy.get('.month-grid__cell').last().should('be.visible');
  });

  it('telly band shows venue:title pairs and pauses', () => {
    cy.visit('/');
    cy.get('.telly__copy').first().should('contain', 'PMK INNSBRUCK: MOLCHAT DOMA');
    cy.get('.telly__pause').click().should('have.attr', 'aria-pressed', 'true');
  });
});

describe('hybrid ui — a11y drawer features', () => {
  it('font scale actually scales rem text; dyslexia toggles the font tokens', () => {
    cy.viewport(1280, 900);
    cy.visit('/');
    cy.get('html').should('have.css', 'font-size', '16px');
    cy.get('[aria-label="Barrierefreiheits-Einstellungen"]').click();
    cy.get('[aria-label="Schriftgröße groß"]').click();
    cy.get('html').should('have.css', 'font-size', '20.8px');
    cy.get('[aria-label="Schriftgröße klein"]').click();
    cy.get('html').should('have.css', 'font-size', '16px');
    cy.get('[aria-label="Legasthenie-Schrift"]').check({ force: true });
    cy.get('html').should('have.attr', 'data-dyslexia');
  });
});

describe('hybrid ui — light theme', () => {
  it('badges and console keep AA-safe colors in Latte', () => {
    cy.viewport(1280, 900);
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('wosweat-a11y', JSON.stringify({
          fontSize: 's', highContrast: false, dyslexiaFont: false, theme: 'light',
        }));
      },
    });
    cy.get('.date-pill:not(.date-pill--today) .date-pill-count').first()
      .should('have.css', 'color', 'rgb(76, 79, 105)');
    cy.get('.header-artifact').should('have.css', 'color', 'rgb(108, 111, 133)');
    cy.contains('button', 'KONSOLE').click();
    cy.get('.console').should('have.css', 'background-color', 'rgb(17, 17, 27)');
  });
});

describe('hybrid ui — mobile', () => {
  beforeEach(() => cy.viewport(390, 844));

  it('no horizontal scroll, telly visible, list rows stack', () => {
    cy.visit('/');
    cy.get('.event-list__row').should('have.length', 3);
    cy.get('.telly').should('be.visible');
    cy.window().then(w =>
      expect(w.document.documentElement.scrollWidth).to.be.lte(390));
  });
});
