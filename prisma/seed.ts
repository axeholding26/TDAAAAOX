// Seed Axso — données de test réalistes pour 3 boutiques africaines
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { provisionerThemeInitial } from "../lib/axso-design-library";

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://postgres:Admin@localhost:5432/axso",
});

const prisma = new PrismaClient({ adapter } as any);

// Images placeholder Unsplash libres
const IMAGES_MODE = [
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800",
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800",
  "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
];

const IMAGES_BEAUTE = [
  "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800",
  "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800",
  "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800",
  "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800",
];

const IMAGES_ALIMENTAIRE = [
  "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=800",
  "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800",
  "https://images.unsplash.com/photo-1516714435131-44d6b64dc6a2?w=800",
  "https://images.unsplash.com/photo-1547592180-85f173990554?w=800",
];

async function main() {
  console.log("🌍 Démarrage du seed Axso...");

  // Nettoyer la base
  await prisma.analytics.deleteMany();
  await prisma.avis.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.ligneCommande.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.escrow.deleteMany();
  await prisma.commande.deleteMany();
  await prisma.codePromo.deleteMany();
  await prisma.variante.deleteMany();
  await prisma.produit.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.client.deleteMany();
  await prisma.membreEquipe.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // ==========================================
  // TENANT 1 — Mode Aminata (Dakar, Sénégal)
  // ==========================================
  const tenantMode = await prisma.tenant.create({
    data: {
      slug: "mode-aminata",
      nomBoutique: "Mode Aminata",
      description: "La mode africaine contemporaine à votre portée",
      categorie: "Mode & Vêtements",
      pays: "SN",
      devise: "XOF",
      whatsapp: "+221771234567",
      email: "aminata@modeaminata.sn",
      telephone: "+221771234567",
      adresse: "Rue 10, Almadies, Dakar",
      logoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200",
      commissionRate: 0.03,
      statut: "active",
      planType: "premium",
      metaTitle: "Mode Aminata — Mode africaine contemporaine",
      metaDescription: "Découvrez la mode africaine contemporaine chez Mode Aminata. Vêtements, accessoires et bijoux artisanaux.",
    },
  });

  // Utilisateur propriétaire
  const userMode = await prisma.user.create({
    data: {
      name: "Aminata Diallo",
      email: "aminata@modeaminata.sn",
      password: await hash("axso2024", 10),
      tenantId: tenantMode.id,
      role: "owner",
    },
  });

  // Collections
  const collMode1 = await prisma.collection.create({
    data: {
      tenantId: tenantMode.id,
      nom: "Prêt-à-porter",
      slug: "pret-a-porter",
      description: "Vêtements modernes inspirés de la culture africaine",
      imageUrl: IMAGES_MODE[0],
      actif: true,
    },
  });

  const collMode2 = await prisma.collection.create({
    data: {
      tenantId: tenantMode.id,
      nom: "Accessoires",
      slug: "accessoires",
      description: "Bijoux et accessoires artisanaux",
      imageUrl: IMAGES_MODE[1],
      actif: true,
    },
  });

  // 10 Produits Mode Aminata
  const produitsMode = [
    { nom: "Robe Wax Moderne", prix: 25000, stock: 15, categorie: "Robes", image: IMAGES_MODE[0] },
    { nom: "Boubou Élégant Homme", prix: 35000, prixCompare: 45000, stock: 8, categorie: "Boubous", image: IMAGES_MODE[1] },
    { nom: "Ensemble Ankara Femme", prix: 30000, stock: 12, categorie: "Ensembles", image: IMAGES_MODE[2] },
    { nom: "Collier Perles Traditionnelles", prix: 8500, prixCompare: 12000, stock: 25, categorie: "Bijoux", image: IMAGES_MODE[3] },
    { nom: "Sandales Cuir Artisanales", prix: 18000, stock: 10, categorie: "Chaussures", image: IMAGES_MODE[0] },
    { nom: "Tissu Wax 6 Yards", prix: 12000, stock: 50, categorie: "Tissus", image: IMAGES_MODE[1] },
    { nom: "Foulard Bogolan", prix: 9000, prixCompare: 13000, stock: 30, categorie: "Accessoires", image: IMAGES_MODE[2] },
    { nom: "Jupe Longue Batik", prix: 22000, stock: 7, categorie: "Jupes", image: IMAGES_MODE[3] },
    { nom: "Bracelet Argent Afrique", prix: 15000, stock: 20, categorie: "Bijoux", image: IMAGES_MODE[0] },
    { nom: "Chapeau Raphia Artisanal", prix: 6500, prixCompare: 9000, stock: 35, categorie: "Accessoires", image: IMAGES_MODE[1] },
  ];

  const produitsModeCrees = [];
  for (const p of produitsMode) {
    const slug = p.nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    const produit = await prisma.produit.create({
      data: {
        tenantId: tenantMode.id,
        nom: p.nom,
        slug,
        prix: p.prix,
        prixCompare: p.prixCompare,
        stock: p.stock,
        categorie: p.categorie,
        images: [p.image],
        actif: true,
        featured: Math.random() > 0.7,
        ventes: Math.floor(Math.random() * 50),
        vues: Math.floor(Math.random() * 500),
        collections: { connect: [{ id: collMode1.id }] },
      },
    });
    // Variantes pour les vêtements
    if (["Robes", "Boubous", "Ensembles", "Jupes"].includes(p.categorie)) {
      for (const taille of ["S", "M", "L", "XL"]) {
        await prisma.variante.create({
          data: {
            produitId: produit.id,
            nom: "Taille",
            valeur: taille,
            stock: Math.floor(p.stock / 4),
          },
        });
      }
    }
    produitsModeCrees.push(produit);
  }

  // 15 Clients Mode Aminata
  const clientsMode = [];
  const nomsClients = ["Fatou Sow", "Mariama Ba", "Aissatou Fall", "Rokhaya Ndiaye", "Ndéye Guèye", "Khady Thiaw", "Adja Koïta", "Penda Sarr", "Bintou Diallo", "Mame Diarra", "Seynabou Mbaye", "Yacine Traoré", "Rama Sy", "Dieynaba Camara", "Awa Badji"];
  for (let i = 0; i < 15; i++) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenantMode.id,
        nom: nomsClients[i],
        email: `client${i + 1}@modeaminata.test`,
        telephone: `+2217${Math.floor(10000000 + Math.random() * 90000000)}`,
        ville: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor"][Math.floor(Math.random() * 4)],
        pays: "SN",
        totalCommandes: Math.floor(Math.random() * 10),
        totalDepense: Math.floor(Math.random() * 500000),
      },
    });
    clientsMode.push(client);
  }

  // 20 Commandes Mode Aminata
  const statutsCommande = ["en_attente", "confirmee", "en_preparation", "expediee", "livree", "livree", "livree"];
  const statutsPaiement = ["pending", "completed", "completed", "completed", "completed", "completed", "failed"];

  for (let i = 0; i < 20; i++) {
    const client = clientsMode[Math.floor(Math.random() * clientsMode.length)];
    const produit = produitsModeCrees[Math.floor(Math.random() * produitsModeCrees.length)];
    const quantite = Math.floor(Math.random() * 3) + 1;
    const sousTotal = produit.prix * quantite;
    const livraison = 2000;
    const total = sousTotal + livraison;
    const statut = statutsCommande[Math.floor(Math.random() * statutsCommande.length)];
    const paiementStatut = statut === "livree" ? "completed" : statutsPaiement[Math.floor(Math.random() * statutsPaiement.length)];
    const dateCreation = new Date();
    dateCreation.setDate(dateCreation.getDate() - Math.floor(Math.random() * 30));

    const commande = await prisma.commande.create({
      data: {
        numero: `AX-${dateCreation.toISOString().slice(0, 10).replace(/-/g, "")}-${1000 + i}`,
        tenantId: tenantMode.id,
        clientId: client.id,
        clientNom: client.nom,
        clientEmail: client.email,
        clientTelephone: client.telephone || "+221770000000",
        adresseLivraison: "Rue 10, Almadies",
        ville: client.ville || "Dakar",
        pays: "SN",
        montantSousTotal: sousTotal,
        montantLivraison: livraison,
        montantTotal: total,
        devise: "XOF",
        statut,
        paiementStatut,
        methodePaiement: ["Wave", "Orange Money", "Visa"][Math.floor(Math.random() * 3)],
        createdAt: dateCreation,
      },
    });

    await prisma.ligneCommande.create({
      data: {
        commandeId: commande.id,
        produitId: produit.id,
        nom: produit.nom,
        prix: produit.prix,
        quantite,
        imageUrl: produit.images[0],
      },
    });

    if (paiementStatut === "completed") {
      await prisma.commission.create({
        data: {
          commandeId: commande.id,
          tenantId: tenantMode.id,
          montantCommande: total,
          montantCommission: Math.round(total * 0.03),
          montantMarchand: Math.round(total * 0.97),
          taux: 0.03,
          devise: "XOF",
          statut: statut === "livree" ? "captured" : "pending",
          capturedAt: statut === "livree" ? new Date() : null,
        },
      });
    }
  }

  // Codes promo Mode Aminata
  await prisma.codePromo.create({
    data: {
      tenantId: tenantMode.id,
      code: "AMINATA10",
      type: "pourcentage",
      valeur: 10,
      minCommande: 15000,
      maxUtilisations: 100,
      utilisations: 23,
      actif: true,
    },
  });

  await prisma.codePromo.create({
    data: {
      tenantId: tenantMode.id,
      code: "DAKAR5000",
      type: "montant_fixe",
      valeur: 5000,
      minCommande: 30000,
      actif: true,
    },
  });

  // Avis clients
  const commentairesPositifs = [
    "Excellent produit ! Qualité parfaite.",
    "Livraison rapide, très satisfaite !",
    "Tissu magnifique, exactement comme sur les photos.",
    "Je recommande vivement cette boutique.",
    "Super service client et beau produit !",
  ];

  for (let i = 0; i < 8; i++) {
    await prisma.avis.create({
      data: {
        tenantId: tenantMode.id,
        produitId: produitsModeCrees[i % produitsModeCrees.length].id,
        clientId: clientsMode[i % clientsMode.length].id,
        note: Math.floor(Math.random() * 2) + 4,
        commentaire: commentairesPositifs[i % commentairesPositifs.length],
        verifie: true,
        approuve: true,
      },
    });
  }

  // Provisionne un design de la bibliothèque AXSO Design maintenant que les
  // vrais produits existent — remplace l'ancien themeId classique en dur.
  const themeMode = await provisionerThemeInitial({
    tenantId: tenantMode.id, categorie: tenantMode.categorie, slug: tenantMode.slug,
    nomBoutique: tenantMode.nomBoutique, devise: tenantMode.devise, commissionRate: tenantMode.commissionRate ?? 0.06,
  });
  await prisma.tenant.update({ where: { id: tenantMode.id }, data: { themeId: themeMode.id } });

  console.log("✅ Tenant 1 — Mode Aminata créé");

  // ==========================================
  // TENANT 2 — Beauté Grâce (Abidjan, Côte d'Ivoire)
  // ==========================================
  const tenantBeaute = await prisma.tenant.create({
    data: {
      slug: "beaute-grace",
      nomBoutique: "Beauté Grâce",
      description: "Cosmétiques naturels africains pour une peau rayonnante",
      categorie: "Beauté & Cosmétiques",
      pays: "CI",
      devise: "XOF",
      whatsapp: "+2250701234567",
      email: "grace@beautegrace.ci",
      telephone: "+2250701234567",
      adresse: "Cocody Riviera 3, Abidjan",
      logoUrl: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200",
      commissionRate: 0.03,
      statut: "active",
      planType: "gratuit",
      metaTitle: "Beauté Grâce — Cosmétiques naturels africains",
      metaDescription: "Huiles, crèmes et soins naturels à base d'ingrédients africains 100% naturels.",
    },
  });

  await prisma.user.create({
    data: {
      name: "Grâce Kouassi",
      email: "grace@beautegrace.ci",
      password: await hash("axso2024", 10),
      tenantId: tenantBeaute.id,
      role: "owner",
    },
  });

  const collBeaute = await prisma.collection.create({
    data: {
      tenantId: tenantBeaute.id,
      nom: "Soins Visage",
      slug: "soins-visage",
      description: "Soins naturels pour un teint éclatant",
      imageUrl: IMAGES_BEAUTE[0],
      actif: true,
    },
  });

  const produitsBeaute = [
    { nom: "Huile de Baobab Pure", prix: 12000, stock: 30, categorie: "Huiles" },
    { nom: "Savon Noir Traditionnel", prix: 3500, prixCompare: 5000, stock: 100, categorie: "Savons" },
    { nom: "Beurre de Karité Brut", prix: 8000, stock: 50, categorie: "Corps" },
    { nom: "Huile de Coco Vierge", prix: 7500, stock: 40, categorie: "Huiles" },
    { nom: "Crème Éclat Visage Argile", prix: 15000, prixCompare: 18000, stock: 20, categorie: "Visage" },
    { nom: "Masque Argile Kaolin", prix: 9000, stock: 35, categorie: "Visage" },
    { nom: "Sérum Vitamine C Naturel", prix: 22000, stock: 15, categorie: "Sérum" },
    { nom: "Gommage Sucre Coco", prix: 6500, prixCompare: 8000, stock: 45, categorie: "Corps" },
    { nom: "Huile Essentielle Ylang", prix: 11000, stock: 25, categorie: "Huiles" },
    { nom: "Lotion Corporelle Hibiscus", prix: 9500, stock: 30, categorie: "Corps" },
  ];

  const produitsBeauteCrees = [];
  for (const p of produitsBeaute) {
    const slug = p.nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    const img = IMAGES_BEAUTE[Math.floor(Math.random() * IMAGES_BEAUTE.length)];
    const produit = await prisma.produit.create({
      data: {
        tenantId: tenantBeaute.id,
        nom: p.nom,
        slug,
        prix: p.prix,
        prixCompare: (p as any).prixCompare,
        stock: p.stock,
        categorie: p.categorie,
        images: [img],
        actif: true,
        featured: Math.random() > 0.7,
        ventes: Math.floor(Math.random() * 80),
        vues: Math.floor(Math.random() * 800),
        collections: { connect: [{ id: collBeaute.id }] },
      },
    });
    produitsBeauteCrees.push(produit);
  }

  const clientsBeaute = [];
  const nomsClientsCI = ["Aya Ouattara", "Bénédicte Kra", "Chantal Bamba", "Djeneba Coulibaly", "Estelle Konan", "Fatoumata Diomandé", "Ghislaine Yao", "Honorine Touré", "Irène Koffi", "Jocelyne Gbagbo", "Karine Soro", "Laure Guei", "Marie-Claire Doumbia", "Natacha Traoré", "Olive Fofana"];
  for (let i = 0; i < 15; i++) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenantBeaute.id,
        nom: nomsClientsCI[i],
        email: `cliente${i + 1}@beautegrace.test`,
        telephone: `+22507${Math.floor(10000000 + Math.random() * 90000000)}`,
        ville: ["Abidjan", "Bouaké", "Daloa", "Yamoussoukro"][Math.floor(Math.random() * 4)],
        pays: "CI",
        totalCommandes: Math.floor(Math.random() * 8),
        totalDepense: Math.floor(Math.random() * 300000),
      },
    });
    clientsBeaute.push(client);
  }

  for (let i = 0; i < 20; i++) {
    const client = clientsBeaute[Math.floor(Math.random() * clientsBeaute.length)];
    const produit = produitsBeauteCrees[Math.floor(Math.random() * produitsBeauteCrees.length)];
    const quantite = Math.floor(Math.random() * 4) + 1;
    const sousTotal = produit.prix * quantite;
    const total = sousTotal + 1500;
    const statut = statutsCommande[Math.floor(Math.random() * statutsCommande.length)];
    const dateCreation = new Date();
    dateCreation.setDate(dateCreation.getDate() - Math.floor(Math.random() * 30));

    const commande = await prisma.commande.create({
      data: {
        numero: `AX-${dateCreation.toISOString().slice(0, 10).replace(/-/g, "")}-B${1000 + i}`,
        tenantId: tenantBeaute.id,
        clientId: client.id,
        clientNom: client.nom,
        clientEmail: client.email,
        clientTelephone: client.telephone || "+2250700000000",
        adresseLivraison: "Cocody Riviera",
        ville: client.ville || "Abidjan",
        pays: "CI",
        montantSousTotal: sousTotal,
        montantLivraison: 1500,
        montantTotal: total,
        devise: "XOF",
        statut,
        paiementStatut: statut === "livree" ? "completed" : "pending",
        methodePaiement: ["MTN MoMo", "Orange Money", "Wave"][Math.floor(Math.random() * 3)],
        createdAt: dateCreation,
      },
    });

    await prisma.ligneCommande.create({
      data: {
        commandeId: commande.id,
        produitId: produit.id,
        nom: produit.nom,
        prix: produit.prix,
        quantite,
        imageUrl: produit.images[0],
      },
    });
  }

  await prisma.codePromo.create({
    data: {
      tenantId: tenantBeaute.id,
      code: "GRACE15",
      type: "pourcentage",
      valeur: 15,
      minCommande: 20000,
      actif: true,
    },
  });

  const themeBeaute = await provisionerThemeInitial({
    tenantId: tenantBeaute.id, categorie: tenantBeaute.categorie, slug: tenantBeaute.slug,
    nomBoutique: tenantBeaute.nomBoutique, devise: tenantBeaute.devise, commissionRate: tenantBeaute.commissionRate ?? 0.06,
  });
  await prisma.tenant.update({ where: { id: tenantBeaute.id }, data: { themeId: themeBeaute.id } });

  console.log("✅ Tenant 2 — Beauté Grâce créé");

  // ==========================================
  // TENANT 3 — Marché Douala (Cameroun)
  // ==========================================
  const tenantMarche = await prisma.tenant.create({
    data: {
      slug: "marche-douala",
      nomBoutique: "Marché Douala",
      description: "Produits artisanaux et alimentaires du Cameroun",
      categorie: "Alimentation & Artisanat",
      pays: "CM",
      devise: "XAF",
      whatsapp: "+237691234567",
      email: "contact@marchedouala.cm",
      telephone: "+237691234567",
      adresse: "Bonanjo, Douala",
      logoUrl: "https://images.unsplash.com/photo-1466637574441-749b8f19452f?w=200",
      commissionRate: 0.03,
      statut: "active",
      planType: "gratuit",
      metaTitle: "Marché Douala — Artisanat et produits camerounais",
      metaDescription: "Découvrez l'artisanat authentique et les produits alimentaires du Cameroun directement chez vous.",
    },
  });

  await prisma.user.create({
    data: {
      name: "Jean-Pierre Mbarga",
      email: "contact@marchedouala.cm",
      password: await hash("axso2024", 10),
      tenantId: tenantMarche.id,
      role: "owner",
    },
  });

  const collMarche = await prisma.collection.create({
    data: {
      tenantId: tenantMarche.id,
      nom: "Produits du terroir",
      slug: "produits-terroir",
      description: "Authenticité camerounaise",
      imageUrl: IMAGES_ALIMENTAIRE[0],
      actif: true,
    },
  });

  const produitsMarche = [
    { nom: "Piment de Cayenne Séché 500g", prix: 2500, stock: 200, categorie: "Épices" },
    { nom: "Huile de Palme Rouge Pure 1L", prix: 4500, prixCompare: 6000, stock: 80, categorie: "Huiles" },
    { nom: "Café Arabica Cameroun 250g", prix: 8000, stock: 60, categorie: "Café & Thé" },
    { nom: "Poivre de Penja Blanc 100g", prix: 6500, stock: 40, categorie: "Épices" },
    { nom: "Miel Sauvage de Forêt 500ml", prix: 12000, prixCompare: 15000, stock: 25, categorie: "Miel" },
    { nom: "Vannerie Bamiléké Grand Panier", prix: 25000, stock: 10, categorie: "Artisanat" },
    { nom: "Masque Traditionnel Bassa", prix: 45000, prixCompare: 55000, stock: 5, categorie: "Art" },
    { nom: "Safou (Prune Africaine) 1kg", prix: 3500, stock: 150, categorie: "Fruits" },
    { nom: "Vin de Palme Traditionnel 1L", prix: 5000, stock: 30, categorie: "Boissons" },
    { nom: "Écorce de Prunus africana 100g", prix: 9000, stock: 35, categorie: "Plantes" },
  ];

  const produitsMarcheCrees = [];
  for (const p of produitsMarche) {
    const slug = p.nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
    const img = IMAGES_ALIMENTAIRE[Math.floor(Math.random() * IMAGES_ALIMENTAIRE.length)];
    const produit = await prisma.produit.create({
      data: {
        tenantId: tenantMarche.id,
        nom: p.nom,
        slug,
        prix: p.prix,
        prixCompare: (p as any).prixCompare,
        stock: p.stock,
        categorie: p.categorie,
        images: [img],
        actif: true,
        featured: Math.random() > 0.7,
        ventes: Math.floor(Math.random() * 100),
        vues: Math.floor(Math.random() * 1000),
        collections: { connect: [{ id: collMarche.id }] },
      },
    });
    produitsMarcheCrees.push(produit);
  }

  const clientsMarche = [];
  const nomsCM = ["Paul Biya Nkoulou", "Christelle Mballa", "Roger Abanda", "Sylvie Ekounou", "Francis Manga", "Rose-Marie Eto'o", "Emmanuel Njoya", "Nadège Fouda", "Bertrand Essama", "Clara Mbida", "Victor Ndjomo", "Alice Tchouta", "Martin Ngassa", "Brigitte Owono", "Samuel Bekolo"];
  for (let i = 0; i < 15; i++) {
    const client = await prisma.client.create({
      data: {
        tenantId: tenantMarche.id,
        nom: nomsCM[i],
        email: `acheteur${i + 1}@marchedouala.test`,
        telephone: `+23769${Math.floor(1000000 + Math.random() * 9000000)}`,
        ville: ["Douala", "Yaoundé", "Bafoussam", "Garoua"][Math.floor(Math.random() * 4)],
        pays: "CM",
        totalCommandes: Math.floor(Math.random() * 12),
        totalDepense: Math.floor(Math.random() * 600000),
      },
    });
    clientsMarche.push(client);
  }

  for (let i = 0; i < 20; i++) {
    const client = clientsMarche[Math.floor(Math.random() * clientsMarche.length)];
    const produit = produitsMarcheCrees[Math.floor(Math.random() * produitsMarcheCrees.length)];
    const quantite = Math.floor(Math.random() * 5) + 1;
    const sousTotal = produit.prix * quantite;
    const total = sousTotal + 3000;
    const statut = statutsCommande[Math.floor(Math.random() * statutsCommande.length)];
    const dateCreation = new Date();
    dateCreation.setDate(dateCreation.getDate() - Math.floor(Math.random() * 30));

    const commande = await prisma.commande.create({
      data: {
        numero: `AX-${dateCreation.toISOString().slice(0, 10).replace(/-/g, "")}-D${1000 + i}`,
        tenantId: tenantMarche.id,
        clientId: client.id,
        clientNom: client.nom,
        clientEmail: client.email,
        clientTelephone: client.telephone || "+237690000000",
        adresseLivraison: "Bonanjo Centre-ville",
        ville: client.ville || "Douala",
        pays: "CM",
        montantSousTotal: sousTotal,
        montantLivraison: 3000,
        montantTotal: total,
        devise: "XAF",
        statut,
        paiementStatut: statut === "livree" ? "completed" : "pending",
        methodePaiement: ["MTN MoMo CM", "Orange Money CM", "Visa"][Math.floor(Math.random() * 3)],
        createdAt: dateCreation,
      },
    });

    await prisma.ligneCommande.create({
      data: {
        commandeId: commande.id,
        produitId: produit.id,
        nom: produit.nom,
        prix: produit.prix,
        quantite,
        imageUrl: produit.images[0],
      },
    });
  }

  await prisma.codePromo.create({
    data: {
      tenantId: tenantMarche.id,
      code: "DOUALA20",
      type: "pourcentage",
      valeur: 20,
      minCommande: 10000,
      maxUtilisations: 50,
      utilisations: 12,
      actif: true,
    },
  });

  const themeMarche = await provisionerThemeInitial({
    tenantId: tenantMarche.id, categorie: tenantMarche.categorie, slug: tenantMarche.slug,
    nomBoutique: tenantMarche.nomBoutique, devise: tenantMarche.devise, commissionRate: tenantMarche.commissionRate ?? 0.06,
  });
  await prisma.tenant.update({ where: { id: tenantMarche.id }, data: { themeId: themeMarche.id } });

  console.log("✅ Tenant 3 — Marché Douala créé");

  // ==========================================
  // ANALYTICS — 30 jours pour chaque tenant
  // ==========================================
  const tenants = [tenantMode, tenantBeaute, tenantMarche];
  const typesAnalytics = ["page_view", "product_view", "add_to_cart", "purchase", "search"];

  for (const tenant of tenants) {
    for (let j = 0; j < 30; j++) {
      const date = new Date();
      date.setDate(date.getDate() - j);

      for (const type of typesAnalytics) {
        const multiplicateur = type === "page_view" ? 100 : type === "product_view" ? 40 : type === "add_to_cart" ? 15 : type === "purchase" ? 5 : 20;
        await prisma.analytics.create({
          data: {
            tenantId: tenant.id,
            date,
            type,
            valeur: Math.floor(Math.random() * multiplicateur) + 1,
            metadata: { source: ["direct", "google", "whatsapp", "facebook"][Math.floor(Math.random() * 4)] },
          },
        });
      }
    }
  }

  console.log("✅ Analytics 30 jours créées pour les 3 boutiques");
  console.log("\n🎉 Seed Axso terminé avec succès !");
  console.log("📊 3 boutiques | 30 produits | 45 clients | 60 commandes | Analytics 30j");
  console.log("\n🔑 Comptes de test :");
  console.log("  mode-aminata : aminata@modeaminata.sn / axso2024");
  console.log("  beaute-grace : grace@beautegrace.ci / axso2024");
  console.log("  marche-douala : contact@marchedouala.cm / axso2024");
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
