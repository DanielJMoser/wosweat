import { useState } from 'react';
import './Impressum.css';

const Impressum: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <footer className="impressum">
      <h2 className="impressum__header">
        <button className="impressum__toggle" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          Impressum
          <span aria-hidden="true">{open ? '▲' : '▼'}</span>
        </button>
      </h2>
      <div className={`impressum__content${open ? ' impressum__content--open' : ''}`} inert={!open}>
        <div className="impressum__inner">
          <p><b>Medieninhaber &amp; Herausgeber:</b> Daniel Moser</p>
          <p><b>Wohnort:</b> Brunecker Strasse 2a, 6020 Innsbruck, Tirol, Österreich</p>
          <p><b>Kontakt:</b> wosweat@protonmail.com</p>
          <p>
            Offenlegung gem. §25 MedienG: wosweat ist ein privates, nicht-kommerzielles
            Informationsangebot über Veranstaltungen in Innsbruck. Veranstaltungsdaten
            stammen von den Websites der jeweiligen Venues; alle Angaben ohne Gewähr.
            Für Inhalte verlinkter externer Seiten sind deren Betreiber verantwortlich.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Impressum;
