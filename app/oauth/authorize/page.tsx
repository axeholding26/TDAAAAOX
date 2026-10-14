// Écran d'autorisation d'une IA externe (Claude, ChatGPT, Gemini…) : le marchand, connecté
// à Axso, choisit la boutique et les droits. L'IA ne voit jamais ses identifiants : elle
// reçoit un code à usage unique, échangé contre un jeton (app/api/oauth/token).
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { boutiquesDuCompte } from "@/lib/tenant";
import { planActif } from "@/lib/abonnement";
import { DOMAINES, SCOPES_FINS, lireClientId } from "@/lib/controle-ia/regles";
import { emettreCode, planSuffisant } from "@/lib/controle-ia/serveur";

export const metadata = { title: "Autoriser une IA — Axso" };

type Demande = { client_id: string; redirect_uri: string; code_challenge: string; state: string };
const CHAMPS = ["client_id", "redirect_uri", "code_challenge", "state"] as const;

/** Client signé par Axso et adresse de retour déclarée : sinon on ne redirige nulle part. */
function demandeValide(d: Demande) {
  const client = lireClientId(d.client_id);
  return client && client.redirectUris.includes(d.redirect_uri) && /^[A-Za-z0-9_-]{43}$/.test(d.code_challenge) ? client : null;
}

function retour(d: Demande, params: Record<string, string>): never {
  const u = new URL(d.redirect_uri);
  for (const [k, v] of Object.entries({ ...params, ...(d.state && { state: d.state }) })) u.searchParams.set(k, v);
  redirect(u.toString());
}

async function boutiques(userId: string) {
  const { proprietaire, membre } = await boutiquesDuCompte(userId);
  return prisma.tenant.findMany({ where: { id: { in: [...proprietaire, ...membre] } }, select: { id: true, nomBoutique: true }, orderBy: { nomBoutique: "asc" } });
}

async function decider(formData: FormData) {
  "use server";
  const d = Object.fromEntries(CHAMPS.map((c) => [c, String(formData.get(c) ?? "")])) as Demande;
  const client = demandeValide(d);
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!client || !userId) redirect("/connexion");
  if (formData.get("decision") !== "autoriser") retour(d, { error: "access_denied" });

  // Les boutiques doivent appartenir au compte connecté : jamais une boutique simplement nommée dans le formulaire.
  const miennes = (await boutiques(userId)).map((b) => b.id);
  const choisies = [...new Set(formData.getAll("boutiques").map(String))];
  const ici = `/oauth/authorize?${new URLSearchParams({ ...d, response_type: "code", code_challenge_method: "S256" })}`;
  if (!choisies.length || !choisies.every((id) => miennes.includes(id))) redirect(`${ici}&erreur=boutique`);
  for (const id of choisies) if (!planSuffisant((await planActif(id)).plan)) redirect(`${ici}&erreur=plan`);

  // Rien n'est accordé d'office : seulement ce qui est coché ici.
  const scopes = [
    ...Object.keys(DOMAINES).flatMap((dom) => {
      const acces = formData.get(`acces_${dom}`);
      return acces === "read" || acces === "write" ? [`axso:${dom}:${acces}`] : [];
    }),
    ...Object.keys(SCOPES_FINS).filter((s) => formData.get(s) === "on"),
  ];
  // La boutique active du tableau de bord passe en premier : c'est celle sur laquelle l'IA commence.
  const active = (session?.user as any)?.tenantId as string | undefined;
  choisies.sort((a, b) => Number(b === active) - Number(a === active));
  const code = await emettreCode({ userId, boutiques: choisies, client: client.nom, scopes, clientId: d.client_id, redirectUri: d.redirect_uri, challenge: d.code_challenge });
  retour(d, { code });
}

const ERREURS: Record<string, string> = {
  plan: "Le pilotage par une IA externe est disponible à partir du Palier Pro. Passe au Palier Pro dans Axso, puis relance la connexion.",
  boutique: "Choisis au moins une boutique rattachée à ton compte.",
};

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const d = Object.fromEntries(CHAMPS.map((c) => [c, sp[c] ?? ""])) as Demande;
  const client = demandeValide(d);
  const cadre = "min-h-screen flex items-center justify-center bg-gray-50 p-4";

  if (!client || sp.response_type !== "code" || sp.code_challenge_method !== "S256") {
    return <main className={cadre}><p className="ax-card p-6 max-w-md text-sm text-gray-600">Cette demande de connexion est invalide ou incomplète. Relance la connexion depuis ton assistant IA.</p></main>;
  }

  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    const ici = `/oauth/authorize?${new URLSearchParams(sp as Record<string, string>)}`;
    redirect(`/connexion?callbackUrl=${encodeURIComponent(ici)}`);
  }

  const liste = await boutiques(userId);
  const active = (session?.user as any)?.tenantId as string | undefined;

  return (
    <main className={cadre} style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <form action={decider} className="ax-card p-6 w-full max-w-md space-y-5">
        {CHAMPS.map((c) => <input key={c} type="hidden" name={c} value={d[c]} />)}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Relier {client.nom} à Axso</h1>
          <p className="text-sm text-gray-500 mt-1">
            {client.nom} ({new URL(d.redirect_uri).host}) demande à agir sur ta boutique. Il ne verra jamais ton mot de passe, et tu peux couper l&apos;accès à tout moment dans Axso, menu Contrôle IA.
          </p>
        </div>

        {sp.erreur && ERREURS[sp.erreur] && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{ERREURS[sp.erreur]}</p>}

        {liste.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune boutique n&apos;est rattachée à ce compte.</p>
        ) : (
          <>
            <fieldset className="space-y-1.5">
              <legend className="ax-label mb-1.5">{liste.length > 1 ? "Boutiques" : "Boutique"}</legend>
              {liste.map((b) => (
                <label key={b.id} className="flex items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" name="boutiques" value={b.id} defaultChecked={liste.length === 1 || b.id === active} />
                  {b.nomBoutique}
                </label>
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="ax-label mb-1.5">Ce que {client.nom} peut faire</legend>
              {Object.entries(DOMAINES).map(([dom, { libelle }]) => (
                <div key={dom} className="flex items-center justify-between gap-3">
                  <label htmlFor={`acces_${dom}`} className="text-sm text-gray-800">{libelle}</label>
                  <select id={`acces_${dom}`} name={`acces_${dom}`} defaultValue="read" className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm">
                    <option value="">Aucun accès</option>
                    <option value="read">Consulter</option>
                    <option value="write">Consulter et modifier</option>
                  </select>
                </div>
              ))}
              {Object.entries(SCOPES_FINS).map(([scope, libelle]) => (
                <label key={scope} className="flex items-start gap-2 text-sm text-gray-800 pt-1">
                  <input type="checkbox" name={scope} className="mt-1" />
                  {libelle}
                </label>
              ))}
              <p className="text-xs text-gray-400 pt-1">Par défaut, les actions sensibles (prix, envois aux clients, publication) attendent ton accord dans Axso. Les paiements et les envois en masse l&apos;attendent toujours.</p>
            </fieldset>

            <div className="flex gap-2">
              <button type="submit" name="decision" value="refuser" className="ax-btn ax-btn-secondary flex-1">Refuser</button>
              <button type="submit" name="decision" value="autoriser" className="ax-btn ax-btn-primary flex-1">Autoriser</button>
            </div>
          </>
        )}
      </form>
    </main>
  );
}
