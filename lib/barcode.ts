/**
 * Génère un code-barres EAN-13 interne valide (checksum correct, donc
 * scannable par n'importe quel lecteur/scanner de codes-barres réel) pour
 * les produits qui n'ont pas de code d'origine. Préfixe "20" : plage
 * réservée par GS1 à l'usage interne/magasin — jamais un vrai code produit
 * mondial, juste un identifiant unique scannable localement.
 */
export function genererEAN13(): string {
  const corps = "20" + Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  let somme = 0;
  for (let i = 0; i < 12; i++) {
    const chiffre = parseInt(corps[i], 10);
    somme += i % 2 === 0 ? chiffre : chiffre * 3;
  }
  const cle = (10 - (somme % 10)) % 10;
  return corps + cle.toString();
}
