// Connecteur Meta — Facebook, Instagram, Meta Ads
// Graph API v19.0

const GRAPH = "https://graph.facebook.com/v19.0";

function token(tenantToken?: string): string {
  return tenantToken || process.env.META_ACCESS_TOKEN || "";
}

// ── Facebook Posts ─────────────────────────────────────────────────────────

export async function posterFacebook(params: {
  pageId: string;
  message: string;
  imageUrl?: string;
  lienUrl?: string;
  accessToken?: string;
}): Promise<{ succes: boolean; postId?: string; erreur?: string }> {
  const t = token(params.accessToken);
  if (!t) return { succes: false, erreur: "META_ACCESS_TOKEN non configuré" };

  const body: Record<string, string> = { message: params.message, access_token: t };
  if (params.lienUrl) body.link = params.lienUrl;

  // Avec image : upload puis post
  if (params.imageUrl) {
    const photoRes = await fetch(`${GRAPH}/${params.pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: params.imageUrl, caption: params.message, access_token: t }),
    });
    const photoData = await photoRes.json();
    if (photoData.error) return { succes: false, erreur: photoData.error.message };
    return { succes: true, postId: photoData.id };
  }

  const res = await fetch(`${GRAPH}/${params.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) return { succes: false, erreur: data.error.message };
  return { succes: true, postId: data.id };
}

// ── Instagram Posts ────────────────────────────────────────────────────────

export async function posterInstagram(params: {
  igUserId: string;
  caption: string;
  imageUrl: string;
  type?: "IMAGE" | "REELS";
  accessToken?: string;
}): Promise<{ succes: boolean; postId?: string; erreur?: string }> {
  const t = token(params.accessToken);
  if (!t) return { succes: false, erreur: "META_ACCESS_TOKEN non configuré" };

  // Étape 1 : créer le container média
  const containerRes = await fetch(`${GRAPH}/${params.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: params.imageUrl,
      caption: params.caption,
      media_type: params.type || "IMAGE",
      access_token: t,
    }),
  });
  const containerData = await containerRes.json();
  if (containerData.error) return { succes: false, erreur: containerData.error.message };

  // Étape 2 : publier le container
  const publishRes = await fetch(`${GRAPH}/${params.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: containerData.id, access_token: t }),
  });
  const publishData = await publishRes.json();
  if (publishData.error) return { succes: false, erreur: publishData.error.message };
  return { succes: true, postId: publishData.id };
}

// ── Meta Ads ───────────────────────────────────────────────────────────────

export async function creerCampagneAds(params: {
  nom: string;
  objectif: string;
  budget_jour: number;
  pays?: string[];
  age_min?: number;
  age_max?: number;
  url_destination?: string;
  accessToken?: string;
}): Promise<{ succes: boolean; campagneId?: string; erreur?: string }> {
  const t = token(params.accessToken);
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!t || !adAccountId) return { succes: false, erreur: "META_ACCESS_TOKEN ou META_AD_ACCOUNT_ID manquant" };

  const res = await fetch(`${GRAPH}/act_${adAccountId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.nom,
      objective: params.objectif,
      status: "PAUSED",
      special_ad_categories: [],
      access_token: t,
    }),
  });
  const data = await res.json();
  if (data.error) return { succes: false, erreur: data.error.message };

  // Créer l'adset avec budget et ciblage
  const targeting: Record<string, any> = {};
  if (params.pays?.length) targeting.geo_locations = { countries: params.pays };
  if (params.age_min) targeting.age_min = params.age_min;
  if (params.age_max) targeting.age_max = params.age_max;

  const adsetRes = await fetch(`${GRAPH}/act_${adAccountId}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `${params.nom} — AdSet`,
      campaign_id: data.id,
      daily_budget: Math.round(params.budget_jour * 100),
      billing_event: "IMPRESSIONS",
      optimization_goal: "REACH",
      targeting,
      status: "PAUSED",
      access_token: t,
    }),
  });
  const adsetData = await adsetRes.json();

  return {
    succes: true,
    campagneId: data.id,
    ...(adsetData.error && { erreur: `Campagne créée mais adset: ${adsetData.error.message}` }),
  };
}

// ── Stats Page ──────────────────────────────────────────────────────────────

export async function statsPageFacebook(params: {
  pageId: string;
  accessToken?: string;
}): Promise<{ succes: boolean; stats?: any; erreur?: string }> {
  const t = token(params.accessToken);
  if (!t) return { succes: false, erreur: "META_ACCESS_TOKEN non configuré" };

  const res = await fetch(
    `${GRAPH}/${params.pageId}?fields=fan_count,followers_count,name,posts.limit(5){message,created_time,likes.summary(true),shares}&access_token=${t}`
  );
  const data = await res.json();
  if (data.error) return { succes: false, erreur: data.error.message };
  return { succes: true, stats: data };
}
