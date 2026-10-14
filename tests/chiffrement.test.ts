// Axso Connect : chiffrement au repos des jetons des services reliés, et état sans secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chiffrer, dechiffrer, estChiffre } from "@/lib/chiffrement";
import { aEnregistrer, enClair, etatDeLigne } from "@/lib/connect";

const VARS = ["AXSO_CLE_CHIFFREMENT", "AXSO_CLE_CHIFFREMENT_ANCIENNE", "AUTH_SECRET", "NEXTAUTH_SECRET"] as const;
// Chaque test fixe ses propres clés, puis rend l'environnement comme il l'a trouvé.
function avecCles(cles: Partial<Record<(typeof VARS)[number], string>>, f: () => void) {
  const avant = VARS.map((v) => process.env[v]);
  try {
    for (const v of VARS) { if (cles[v] === undefined) delete process.env[v]; else process.env[v] = cles[v]; }
    f();
  } finally {
    VARS.forEach((v, i) => { if (avant[i] === undefined) delete process.env[v]; else process.env[v] = avant[i]; });
  }
}

test("aller-retour, et deux chiffrements du même texte diffèrent", () => avecCles({ AXSO_CLE_CHIFFREMENT: "cle-a" }, () => {
  const jeton = "EAAG-jeton-métà-éè-123";
  const a = chiffrer(jeton), b = chiffrer(jeton);
  assert.ok(estChiffre(a) && a.startsWith("enc:v1:"));
  assert.ok(!a.includes(jeton));
  assert.notEqual(a, b);
  assert.equal(dechiffrer(a), jeton);
  assert.equal(dechiffrer(b), jeton);
  assert.equal(chiffrer(a), a, "une valeur déjà chiffrée n'est pas chiffrée deux fois");
}));

test("valeur héritée en clair rendue telle quelle", () => avecCles({ AXSO_CLE_CHIFFREMENT: "cle-a" }, () => {
  assert.equal(dechiffrer("ya29.ancien-jeton-en-clair"), "ya29.ancien-jeton-en-clair");
  assert.equal(dechiffrer(""), "");
}));

test("altération détectée (GCM) : null, jamais d'exception", () => avecCles({ AXSO_CLE_CHIFFREMENT: "cle-a" }, () => {
  const parts = chiffrer("jeton-secret").split(":");
  for (const i of [2, 3, 4]) {
    const p = [...parts];
    p[i] = (p[i][0] === "A" ? "B" : "A") + p[i].slice(1);
    assert.equal(dechiffrer(p.join(":")), null);
  }
  assert.equal(dechiffrer("enc:v1:n-importe-quoi"), null);
}));

test("rotation : l'ancienne clé déchiffre, la nouvelle chiffre", () => {
  let ancien = "";
  avecCles({ AXSO_CLE_CHIFFREMENT: "cle-a" }, () => { ancien = chiffrer("jeton"); });
  avecCles({ AXSO_CLE_CHIFFREMENT: "cle-b" }, () => assert.equal(dechiffrer(ancien), null, "clé changée sans ancienne clé : illisible"));
  avecCles({ AXSO_CLE_CHIFFREMENT: "cle-b", AXSO_CLE_CHIFFREMENT_ANCIENNE: "cle-a" }, () => {
    assert.equal(dechiffrer(ancien), "jeton");
    const nouveau = chiffrer("jeton");
    avecCles({ AXSO_CLE_CHIFFREMENT: "cle-b" }, () => assert.equal(dechiffrer(nouveau), "jeton", "l'ancienne clé ne sert pas à chiffrer"));
  });
});

test("clé dérivée de AUTH_SECRET, toujours lisible après ajout de la clé dédiée", () => {
  let v = "";
  avecCles({ AUTH_SECRET: "secret-auth" }, () => { v = chiffrer("jeton"); assert.equal(dechiffrer(v), "jeton"); });
  avecCles({ AXSO_CLE_CHIFFREMENT: "cle-dediee", AUTH_SECRET: "secret-auth" }, () => assert.equal(dechiffrer(v), "jeton"));
});

test("aucune clé : on refuse d'écrire, la lecture ne plante pas", () => avecCles({}, () => {
  assert.throws(() => chiffrer("jeton"));
  assert.equal(dechiffrer("jeton-en-clair"), "jeton-en-clair");
  assert.equal(dechiffrer("enc:v1:AAAA:AAAA:AAAA"), null);
}));

const SECRETS = ["JETON-PAGE", "JETON-UTILISATEUR", "JETON-PAGE-2", "JETON-RAFRAICHISSEMENT", "CLE-API"];
const donnees = {
  statut: "actif", pageId: "1234", igUserId: null, accessToken: SECRETS[0],
  config: { user_token: SECRETS[1], user_name: "Awa", pages: [{ id: "1234", name: "Boutique", access_token: SECRETS[2] }], refresh_token: SECRETS[3], apiKey: SECRETS[4], phone_number_id: "555", scope: "a b", expires_at: "2999-01-01T00:00:00.000Z" },
};
const ligne = (d: any) => ({ type: "meta", statut: "actif", pageId: null, igUserId: null, accessToken: null, config: {}, createdAt: new Date(0), updatedAt: new Date(0), ...d });

test("connexion : tous les secrets chiffrés à l'écriture, rendus à la lecture", () => avecCles({ AXSO_CLE_CHIFFREMENT: "cle-a" }, () => {
  const ecrit = aEnregistrer(donnees);
  const brut = JSON.stringify(ecrit);
  for (const s of SECRETS) assert.ok(!brut.includes(s), `${s} écrit en clair`);
  // Les identifiants non secrets restent en clair (le webhook WhatsApp cherche par phone_number_id).
  assert.equal((ecrit.config as any).phone_number_id, "555");
  assert.equal((ecrit.config as any).pages[0].name, "Boutique");
  assert.deepEqual(enClair(ligne(ecrit)).config, donnees.config);
  assert.equal(enClair(ligne(ecrit)).accessToken, SECRETS[0]);
  // Ligne héritée, entièrement en clair : lue telle quelle.
  assert.deepEqual(enClair(ligne(donnees)).config, donnees.config);
  assert.equal(aEnregistrer({ accessToken: null }).accessToken, null);
  assert.deepEqual(aEnregistrer({ statut: "actif" }), { statut: "actif" }, "un champ absent n'est pas écrit");
}));

test("état des connexions : aucun secret, « à reconnecter » si la clé a changé", () => {
  let ecrit: any;
  avecCles({ AXSO_CLE_CHIFFREMENT: "cle-a" }, () => {
    ecrit = aEnregistrer(donnees);
    for (const l of [ligne(ecrit), ligne(donnees)]) {
      const etat = etatDeLigne(l)!;
      const sortie = JSON.stringify(etat);
      for (const s of SECRETS) assert.ok(!sortie.includes(s), `${s} a fuité dans l'état`);
      assert.ok(!sortie.includes("enc:v1:"), "même chiffré, un jeton ne sort pas");
      assert.equal(etat.statut, "actif");
      assert.deepEqual(etat.compte, { pageId: "1234", user_name: "Awa", phone_number_id: "555" });
      assert.deepEqual(etat.droits, ["a", "b"]);
    }
    assert.equal(etatDeLigne(ligne(ecrit))!.chiffre, true);
    assert.equal(etatDeLigne(ligne(donnees))!.chiffre, false, "ligne héritée signalée comme pas encore chiffrée");
    assert.equal(etatDeLigne(ligne({ config: { ...ecrit.config, expires_at: "2000-01-01" }, accessToken: ecrit.accessToken }))!.statut, "expire");
    assert.equal(etatDeLigne(ligne({ type: "chatbot_whatsapp", config: { personnalite: "pro" } })), null, "sans jeton, rien de relié");
  });
  avecCles({ AXSO_CLE_CHIFFREMENT: "autre-cle" }, () => {
    assert.equal(etatDeLigne(ligne(ecrit))!.statut, "a_reconnecter");
    assert.equal(enClair(ligne(ecrit)).accessToken, null);
  });
});
