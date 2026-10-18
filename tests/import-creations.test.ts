// Import IA → boutique : fichiers reconnus à leurs octets (pas à leur nom), exécutables refusés,
// adresses internes refusées (SSRF), jamais de publication d'un produit incomplet.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  delaiReprise, descriptionAvecBenefices, estExecutable, ipInterdite, manquePourPublier, nomPropre, signature, urlAcceptee, verifierFichier,
} from "@/lib/import-creations/regles";

const PDF = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\n%%EOF");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100)]);
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]);

test("signature : le type vient des octets", () => {
  assert.equal(signature(PDF), "pdf");
  assert.equal(signature(PNG), "png");
  assert.equal(signature(JPG), "jpg");
  assert.equal(signature(ZIP), "zip");
  assert.equal(signature(Buffer.from("RIFF\0\0\0\0WEBPVP8 ")), "webp");
  assert.equal(signature(Buffer.from("\0\0\0\x18ftypmp42")), "mp4");
  assert.equal(signature(Buffer.from("ID3\x03\0")), "mp3");
  assert.equal(signature(Buffer.from("nom;prix\nguide;5000\n")), "txt");
  assert.equal(signature(Buffer.from([0, 1, 2, 3, 0, 9])), null);
});

test("exécutables, scripts et pages web refusés même renommés", () => {
  for (const b of [EXE, ELF, Buffer.from("#!/bin/sh\nrm -rf /"), Buffer.from("<html><script>x</script>"), Buffer.from('<?xml version="1.0"?><svg onload="x">')]) {
    assert.ok(estExecutable(b));
    assert.equal(verifierFichier(b, "guide.pdf", "fichier").ok, false);
  }
  const r = verifierFichier(EXE, "photo.png", "visuel");
  assert.equal(r.ok, false);
});

test("extension incohérente refusée, formats Office reconnus par l'extension", () => {
  assert.equal(verifierFichier(PDF, "guide.docx", "fichier").ok, false);
  assert.equal(verifierFichier(PNG, "image.jpg", "visuel").ok, false);
  const docx = verifierFichier(ZIP, "modele.docx", "fichier");
  assert.ok(docx.ok && docx.mime.includes("wordprocessingml"));
  const pdf = verifierFichier(PDF, "Guide Final.PDF", "fichier");
  assert.ok(pdf.ok && pdf.mime === "application/pdf");
  const csv = verifierFichier(Buffer.from("a;b\n1;2"), "data.csv", "fichier");
  assert.ok(csv.ok && csv.mime === "text/csv");
  assert.equal(verifierFichier(Buffer.alloc(0), "vide.pdf", "fichier").ok, false);
});

test("un visuel doit être une image", () => {
  assert.equal(verifierFichier(PDF, "couverture.pdf", "visuel").ok, false);
  assert.ok(verifierFichier(PNG, "couverture.png", "visuel").ok);
});

test("SSRF : adresses internes, métadonnées cloud et schémas non https refusés", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
    assert.ok(ipInterdite(ip), ip);
  }
  for (const ip of ["8.8.8.8", "41.202.219.10", "2606:4700::1111"]) assert.ok(!ipInterdite(ip), ip);
  for (const u of [
    "http://exemple.com/a.pdf", "https://127.0.0.1/a.pdf", "https://169.254.169.254/latest/meta-data", "https://[::1]/x", "https://localhost/x",
    "https://user:pw@exemple.com/x", "https://exemple.com:8443/x", "https://intranet/x", "https://serveur.internal/x", "file:///etc/passwd", "ftp://x.com/a",
  ]) assert.equal(urlAcceptee(u), null, u);
  assert.ok(urlAcceptee("https://cdn.exemple.com/guide.pdf?sig=abc"));
});

test("jamais de publication d'un produit incomplet", () => {
  assert.deepEqual(manquePourPublier({ nom: "Guide", prix: 5000, images: ["https://x/i.png"], fichiersStockes: 1 }), []);
  assert.equal(manquePourPublier({ nom: "Guide", prix: 0, images: ["i"], fichiersStockes: 1 }).length, 1);
  assert.equal(manquePourPublier({ nom: "Guide", prix: 5000, images: [], fichiersStockes: 1 }).length, 1);
  assert.equal(manquePourPublier({ nom: "Guide", prix: 5000, images: ["i"], fichiersStockes: 0 }).length, 1);
  assert.equal(manquePourPublier({ nom: " ", prix: -1, images: [], fichiersStockes: 0 }).length, 4);
});

test("reprises temporisées, description et noms propres", () => {
  assert.deepEqual([1, 2, 3].map(delaiReprise), [60_000, 300_000, 1_500_000]);
  assert.equal(descriptionAvecBenefices("Un guide.", ["Méthode", " "]), "Un guide.\n\nCe que vous obtenez :\n• Méthode");
  assert.equal(descriptionAvecBenefices(undefined, []), null);
  assert.equal(nomPropre("../../etc/passwd"), "-..-etc-passwd");
  assert.equal(nomPropre('a<b>"c.pdf'), "a-b-c.pdf");
});
