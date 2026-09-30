// Menus déroulants des deux Constructeurs (boutique et digital), injectés par
// chacun via <StyleCss> : dans globals.css, Turbopack rejette ::picker(select)
// et supprime tout le bloc. Hors @layer, ce CSS prime sur les classes
// Tailwind de chaque <select> ; ceux de la boutique affichée dans l'aperçu
// gardent le style du marchand. La liste des choix n'est stylée que sur
// Chrome 135+ (appearance: base-select) ; ailleurs elle reste native.
export const CSS_MENUS_DEROULANTS = `
.ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) {
  appearance: none;
  min-height: 38px;
  padding: 0 36px 0 12px;
  border: 1px solid #E2E2E5;
  border-radius: 10px;
  background: #FFFFFF url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center / 16px;
  color: #111111;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(17, 17, 17, 0.04);
  transition: border-color .15s, box-shadow .15s, background-color .15s;
}
.ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select):hover { border-color: #C9C9CE; }
.ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select):focus-visible {
  outline: none;
  border-color: #F5A623;
  box-shadow: 0 0 0 3px rgba(245, 166, 35, 0.18);
}
/* Liste des choix stylable (Chrome 135+) ; ailleurs la liste native reste. */
@supports (appearance: base-select) {
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select),
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select)::picker(select) { appearance: base-select; }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select)::picker-icon { display: none; }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select)::picker(select) {
    margin-top: 6px;
    padding: 6px;
    max-height: 320px;
    border: 1px solid #E6E6E9;
    border-radius: 12px;
    background: #FFFFFF;
    box-shadow: 0 16px 40px rgba(17, 17, 17, 0.14), 0 2px 6px rgba(17, 17, 17, 0.06);
  }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) option {
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 14px;
    color: #222222;
  }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) option::checkmark { display: none; }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) option:hover,
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) option:focus-visible { background: #FFF6E5; outline: none; }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) option:checked { background: #FFEFD2; color: #111111; font-weight: 600; }
  .ax-constructeur select:not([data-apercu-page] select, .axs-digital-store select) optgroup {
    padding-top: 4px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: #9A9AA0;
  }
}
`;
