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

  it('toggles to list view and persists across reload', () => {
    cy.visit('/');
    cy.get('.event-card').should('have.length', 3);
    cy.contains('button', 'LISTE').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('.event-list__row').should('have.length', 3);
    cy.reload();
    cy.get('.event-list__row').should('have.length', 3);
  });

  it('list rows are keyboard-activatable', () => {
    cy.visit('/', { onBeforeLoad(win) { win.localStorage.setItem('wosweat-view', 'list'); } });
    cy.window().then(win => cy.stub(win, 'open').as('open'));
    cy.get('.event-list__row').first().focus().type('{enter}');
    cy.get('@open').should('have.been.calledWithMatch', 'https://example.com/');
  });

  it('venue chips filter and expose pressed state', () => {
    cy.visit('/');
    cy.contains('button', 'Alle').should('have.attr', 'aria-pressed', 'true');
    cy.contains('.view-controls__chip', 'PMK').click().should('have.attr', 'aria-pressed', 'true');
    cy.get('.event-card').should('have.length', 1);
  });

  it('console runs queries, reports errors, exports ics', () => {
    cy.visit('/');
    cy.get('[aria-label="WQL-Abfrage"]').type('SELECT * FROM events{enter}');
    cy.get('.console__ok').last().should('contain', 'events (');
    cy.get('[aria-label="WQL-Abfrage"]').type('kaputt{enter}');
    cy.get('.console__err').last().should('contain', '✗');
    cy.get('[aria-label="WQL-Abfrage"]').type("EXPORT ICS WHERE venue = 'PMK'{enter}");
    cy.get('.console__ok').last().should('contain', '.ics');
  });

  it('telly band shows venue:title pairs and pauses', () => {
    cy.visit('/');
    cy.get('.telly__copy').first().should('contain', 'PMK INNSBRUCK: MOLCHAT DOMA');
    cy.get('.telly__pause').click().should('have.attr', 'aria-pressed', 'true');
  });
});

describe('hybrid ui — mobile', () => {
  beforeEach(() => cy.viewport(390, 844));

  it('no horizontal scroll, telly visible, list rows stack', () => {
    cy.visit('/', { onBeforeLoad(win) { win.localStorage.setItem('wosweat-view', 'list'); } });
    cy.get('.event-list__row').should('have.length', 3);
    cy.get('.telly').should('be.visible');
    cy.window().then(w =>
      expect(w.document.documentElement.scrollWidth).to.be.lte(390));
  });
});
