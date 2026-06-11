describe('App shell', () => {
  it('shows the header and date navigation', () => {
    cy.visit('/');
    cy.contains('.header-wordmark', 'wosweat');
    cy.get('.date-pill').should('have.length', 15);
    cy.get('.date-pill[aria-current="date"]').should('exist');
  });
});
