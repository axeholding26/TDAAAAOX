-- Annonces de la bannière « Ma boutique », gérées depuis le Command Center (/admin/annonces).
CREATE TABLE "Annonce" (
    "id" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "texte" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "lien" TEXT NOT NULL,
    "logo" TEXT,
    "fond" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "debut" TIMESTAMP(3),
    "fin" TIMESTAMP(3),
    "pays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "affichages" INTEGER NOT NULL DEFAULT 0,
    "clics" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annonce_pkey" PRIMARY KEY ("id")
);

-- Les 3 annonces codées en dur jusqu'ici : rien ne change visuellement après déploiement.
INSERT INTO "Annonce" ("id", "marque", "titre", "texte", "cta", "lien", "logo", "fond", "accent", "ordre", "updatedAt") VALUES
('kreads', 'KREADS · Partenaire officiel', 'Des vidéos publicitaires qui vendent',
 'Studio de créatives publicitaires : vidéos et visuels pensés pour faire vendre tes produits sur Facebook, TikTok et Instagram.',
 'Découvrir KREADS', 'https://kreads-two.vercel.app/', 'https://kreads-two.vercel.app/assets/kreads-logo-Bmz9VEmd.png',
 'linear-gradient(120deg,#111111 0%,#2A1E0A 100%)', '#F5A623', 0, CURRENT_TIMESTAMP),
('axia', 'AXIA', 'Ton assistant IA travaille pour toi',
 'Demande à AXIA de créer tes produits, modifier ta boutique ou analyser tes ventes, en une phrase.',
 'Parler à AXIA', '/dashboard/axia', NULL,
 'linear-gradient(120deg,#1E1B4B 0%,#312E81 100%)', '#A5B4FC', 1, CURRENT_TIMESTAMP),
('affiliation', 'Affiliation Axso', 'Gagne de l''argent en parrainant',
 'Invite d''autres commerçants sur Axso et touche une commission sur leurs abonnements.',
 'Voir mon lien', '/dashboard/affiliation', NULL,
 'linear-gradient(120deg,#052E16 0%,#14532D 100%)', '#4ADE80', 2, CURRENT_TIMESTAMP);
