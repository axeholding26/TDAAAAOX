"use client";
import { useEffect } from "react";

// Widgets interactifs propres à certains designs AXSO (quiz Clarté, guide de
// respiration Équilibre, minuteur de round Ring). Le script d'origine du
// design n'est jamais exécuté et ses onclick sont retirés à l'import
// (lib/theme-import-clone.ts) : on reproduit ici leur comportement par
// délégation d'événements, repéré aux ids/classes figés des fichiers. Tout
// autre lien du design resté sans destination mène au widget de la page, sinon
// au premier produit, sinon au catalogue — aucun bouton inerte.
const EMBED = "[data-axs-embed-html]";
const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(`${EMBED} ${sel}`);

// ─── Quiz (Clarté) : 2 questions → un vrai produit de la boutique ───────────
let reponse1 = 0;
function etapeQuiz(id: string) {
  document.querySelectorAll(`${EMBED} .quiz-step`).forEach((s) => s.classList.remove("active"));
  $(`#${id}`)?.classList.add("active");
}
function repondreQuiz(opt: HTMLElement, slug: string) {
  const etape = opt.closest(".quiz-step");
  const index = [...(opt.parentElement?.children ?? [])].indexOf(opt);
  if (etape?.id === "qstep-1") { reponse1 = index; etapeQuiz("qstep-2"); return; }
  etapeQuiz("qstep-result");
  const cartes = document.querySelectorAll<HTMLElement>(`${EMBED} #homeGrid > *, ${EMBED} #plpGrid > *`);
  const badge = $("#matchBadge");
  if (badge) badge.textContent = badge.textContent!.replace(/^\d+/, String(88 + ((reponse1 * 4 + index) * 7) % 11));
  const cible = $("#quizResultCard");
  if (!cible) return;
  if (!cartes.length) { cible.innerHTML = ""; const a = document.createElement("a"); a.href = `/${slug}/produits`; a.textContent = "Voir les produits"; cible.appendChild(a); return; }
  const carte = cartes[(reponse1 * 4 + index) % cartes.length].cloneNode(true) as HTMLElement;
  carte.style.width = "100%";
  cible.replaceChildren(carte);
}

// ─── Respiration (Équilibre) : cycle 4-4-4 ────────────────────────────────────
let respiration: ReturnType<typeof setTimeout> | null = null;
function phaseRespiration(i: number) {
  const cercle = $("#breathCircle"), label = $("#breathLabel");
  if (!cercle || !label) { respiration = null; return; } // page quittée
  const [classe, texte] = ([["inhale", "Inspire"], ["hold", "Retiens"], ["exhale", "Expire"]] as const)[i % 3];
  cercle.className = `breath-circle ${classe}`;
  label.textContent = texte;
  respiration = setTimeout(() => phaseRespiration(i + 1), 4000);
}
function basculerRespiration(bouton: HTMLElement) {
  if (respiration) {
    clearTimeout(respiration); respiration = null;
    bouton.textContent = "Commencer";
    const cercle = $("#breathCircle"), label = $("#breathLabel");
    if (cercle) cercle.className = "breath-circle";
    if (label) label.textContent = "Inspire";
  } else {
    bouton.textContent = "Arrêter";
    phaseRespiration(0);
  }
}

// ─── Minuteur de round (Ring) : 3 min travail / 1 min repos ─────────────────
const TRAVAIL = 180, REPOS = 60, CIRC = 2 * Math.PI * 98;
let minuteur: ReturnType<typeof setInterval> | null = null, secondes = TRAVAIL, enTravail = true, rounds = 0;
function afficherMinuteur() {
  const temps = $("#timerTime"), phase = $("#timerPhase"), anneau = document.querySelector<SVGCircleElement>(`${EMBED} #timerRing`), nb = $("#roundsCompleted");
  if (!temps) { if (minuteur) clearInterval(minuteur); minuteur = null; return; } // page quittée
  temps.textContent = `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;
  if (phase) phase.textContent = enTravail ? `ROUND ${rounds + 1} — TRAVAIL` : "REPOS";
  if (nb) nb.textContent = String(rounds);
  if (anneau) {
    anneau.setAttribute("stroke-dasharray", String(CIRC));
    anneau.setAttribute("stroke-dashoffset", String(CIRC * (1 - secondes / (enTravail ? TRAVAIL : REPOS))));
    anneau.style.stroke = enTravail ? "var(--red)" : "var(--success)";
  }
}
function tic() {
  if (--secondes < 0) {
    if (enTravail) { rounds++; enTravail = false; secondes = REPOS - 1; } else { enTravail = true; secondes = TRAVAIL - 1; }
  }
  afficherMinuteur();
}
function basculerMinuteur(bouton: HTMLElement) {
  if (minuteur) { clearInterval(minuteur); minuteur = null; bouton.textContent = "Reprendre"; }
  else { minuteur = setInterval(tic, 1000); bouton.textContent = "Pause"; }
}
function reinitialiserMinuteur() {
  if (minuteur) clearInterval(minuteur);
  minuteur = null; secondes = TRAVAIL; enTravail = true; rounds = 0;
  const bouton = $("#timerStartBtn");
  if (bouton) bouton.textContent = "Démarrer";
  afficherMinuteur();
}

export function WidgetsDesign({ slug }: { slug: string }) {
  useEffect(() => {
    const clic = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>(`${EMBED} button, ${EMBED} a:not([href]):not([data-axs-recherche])`);
      if (!el || el.closest("[data-cat]")) return; // pastilles : FiltresCatalogue
      if (el.matches(".quiz-opt")) return repondreQuiz(el, slug);
      if (el.closest(".quiz-result")) { reponse1 = 0; return etapeQuiz("qstep-1"); }
      if (el.id === "breathToggle") return basculerRespiration(el);
      if (el.id === "timerStartBtn") return basculerMinuteur(el);
      if (el.closest(".timer-controls")) return reinitialiserMinuteur();
      if (el.tagName !== "A") return; // autres boutons : gérés ailleurs (favoris, menu…)
      // Lien sans destination (« Trouver ma routine », « Minuteur de round », « Voir Opal One »…).
      const widget = $("#quizBlock, #timerBlock, .breath-block");
      if (widget) return widget.scrollIntoView({ behavior: "smooth" });
      const produit = document.querySelector<HTMLAnchorElement>(`${EMBED} a[href*="/produits/"]`);
      window.location.assign(produit?.href ?? `/${slug}/produits`);
    };
    document.addEventListener("click", clic);
    return () => document.removeEventListener("click", clic);
  }, [slug]);
  return <style>{`${EMBED} a:not([href]){cursor:pointer}`}</style>;
}
