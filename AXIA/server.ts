/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Product, Order, ReturnRequest, Customer, Message, ECommerceState } from "./src/types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
} else {
  console.warn("⚠️ Warning: GEMINI_API_KEY environment variable is not set. AXIA AI capabilities will run in offline simulation mode.");
}

// ---------------------------------------------------------
// Luxury E-Commerce In-Memory Database (Premium French Brand)
// ---------------------------------------------------------
let products: Product[] = [
  {
    id: "p1",
    name: "Chronographe Étoile d'Or",
    sku: "CHRONO-ET-01",
    category: "Horlogerie",
    stock: 4,
    safetyStock: 8,
    status: "Low Stock",
    price: 4800,
    cost: 2100,
    supplier: "Manufacture Genevoise",
    salesVelocity: 0.8,
    reorderPoint: 5,
    leadTime: 14
  },
  {
    id: "p2",
    name: "Sac Cabas Signature Saffiano",
    sku: "CABAS-SIG-04",
    category: "Maroquinerie",
    stock: 12,
    safetyStock: 10,
    status: "Optimal",
    price: 1850,
    cost: 620,
    supplier: "Atelier Florentin",
    salesVelocity: 1.5,
    reorderPoint: 10,
    leadTime: 10
  },
  {
    id: "p3",
    name: "Écharpe en Soie Cachemire d'Alpage",
    sku: "SOIE-CASH-12",
    category: "Accessoires",
    stock: 25,
    safetyStock: 15,
    status: "Optimal",
    price: 490,
    cost: 150,
    supplier: "Tissage de Lyon",
    salesVelocity: 2.2,
    reorderPoint: 15,
    leadTime: 7
  },
  {
    id: "p4",
    name: "Parfum Essence Noire - Oud Impérial",
    sku: "OUD-IMP-75",
    category: "Parfumerie",
    stock: 2,
    safetyStock: 12,
    status: "Low Stock",
    price: 320,
    cost: 85,
    supplier: "Maison de Grasse",
    salesVelocity: 3.1,
    reorderPoint: 10,
    leadTime: 5
  },
  {
    id: "p5",
    name: "Lunettes de Soleil Éclipse Noir Pur",
    sku: "SUN-ECL-09",
    category: "Accessoires",
    stock: 0,
    safetyStock: 8,
    status: "Out of Stock",
    price: 380,
    cost: 110,
    supplier: "Optique du Jura",
    salesVelocity: 1.8,
    reorderPoint: 8,
    leadTime: 6
  }
];

let customers: Customer[] = [
  {
    id: "c1",
    name: "Hélène de Montaigne",
    email: "helene.montaigne@vip-maison.com",
    phone: "+33 6 12 34 56 78",
    loyaltyTier: "Platinum VIP",
    totalSpent: 18200,
    ordersCount: 9,
    customerLifetimeValue: 18200,
    sentiment: "Delighted",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=120"
  },
  {
    id: "c2",
    name: "Jean-Pierre Laroche",
    email: "jp.laroche@outlook.fr",
    phone: "+33 7 89 45 12 23",
    loyaltyTier: "Gold VIP",
    totalSpent: 9600,
    ordersCount: 4,
    customerLifetimeValue: 9600,
    sentiment: "Neutral",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120"
  },
  {
    id: "c3",
    name: "Amélie Dubois",
    email: "amelie.dubois@gmail.com",
    phone: "+33 6 55 44 33 22",
    loyaltyTier: "Regular",
    totalSpent: 870,
    ordersCount: 2,
    customerLifetimeValue: 870,
    sentiment: "Frustrated",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120"
  }
];

let orders: Order[] = [
  {
    id: "CMD-2026-101",
    customerId: "c1",
    customerName: "Hélène de Montaigne",
    date: "2026-07-15",
    items: [
      { productId: "p1", productName: "Chronographe Étoile d'Or", quantity: 1, price: 4800 },
      { productId: "p3", productName: "Écharpe en Soie Cachemire d'Alpage", quantity: 2, price: 490 }
    ],
    status: "Delivered",
    total: 5780
  },
  {
    id: "CMD-2026-102",
    customerId: "c2",
    customerName: "Jean-Pierre Laroche",
    date: "2026-07-18",
    items: [
      { productId: "p2", productName: "Sac Cabas Signature Saffiano", quantity: 1, price: 1850 }
    ],
    status: "Delivered",
    total: 1850
  },
  {
    id: "CMD-2026-103",
    customerId: "c3",
    customerName: "Amélie Dubois",
    date: "2026-07-19",
    items: [
      { productId: "p4", productName: "Parfum Essence Noire - Oud Impérial", quantity: 1, price: 320 },
      { productId: "p5", productName: "Lunettes de Soleil Éclipse Noir Pur", quantity: 1, price: 380 }
    ],
    status: "Delivered",
    total: 700
  }
];

let returnRequests: ReturnRequest[] = [
  {
    id: "RET-2026-01",
    orderId: "CMD-2026-103",
    customerId: "c3",
    customerName: "Amélie Dubois",
    date: "2026-07-20",
    status: "Pending",
    items: [
      { productId: "p5", productName: "Lunettes de Soleil Éclipse Noir Pur", quantity: 1, refundAmount: 380 }
    ],
    reason: "La monture des lunettes présente un léger défaut d'ajustement au niveau de la branche gauche.",
    aiEligibilityScore: 88,
    aiExplanation: "Le client régulier rapporte un défaut d'ajustement. Recommandation d'approbation automatique sous réserve de retour de l'article pour préservation de la satisfaction client.",
    refundProcessed: false,
    restocked: false
  }
];

let messages: Message[] = [
  {
    id: "m_init",
    sender: "system",
    text: "Console AXIA connectée avec succès au cœur logistique, au studio visuel et au CRM client.",
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
];

// AXSO Integration State (Simulated credentials and logs)
let axsoCredentials = {
  shopDomain: "maison-elite.axso.shop",
  apiToken: "axso_pat_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  webhookSecret: "axso_sec_0987654321fedcbaabcdef",
  isConnected: true
};

let axsoSyncLogs: Array<{ timestamp: string; type: string; message: string }> = [
  { timestamp: new Date(Date.now() - 3600000).toISOString(), type: "info", message: "Connexion initiale établie avec AXSO GraphQL API." },
  { timestamp: new Date(Date.now() - 3500000).toISOString(), type: "graphql", message: "Query GraphQL exécutée { shop { name primaryDomain { url } } } en 45ms. Statut: 200 OK." },
  { timestamp: new Date(Date.now() - 3000000).toISOString(), type: "sync", message: "Synchronisation de 5 fiches produits de prestige réussie." },
  { timestamp: new Date(Date.now() - 2500000).toISOString(), type: "webhook", message: "Enregistrement du webhook 'orders/create' sur l'adresse de webhook sécurisée AXSO - Statut: Actif" },
  { timestamp: new Date(Date.now() - 2400000).toISOString(), type: "webhook", message: "Enregistrement du webhook 'refunds/create' sur l'adresse de webhook sécurisée AXSO - Statut: Actif" }
];

// Helper to update status of a product based on stock and safetyStock
function updateProductStatus(p: Product) {
  if (p.stock === 0) {
    p.status = "Out of Stock";
  } else if (p.stock <= p.safetyStock) {
    p.status = "Low Stock";
  } else {
    p.status = "Optimal";
  }
}

// ---------------------------------------------------------
// Express App Middlewares
// ---------------------------------------------------------
app.use(express.json());

// ---------------------------------------------------------
// REST API Endpoints
// ---------------------------------------------------------

// Retrieve entire state including Shopify config
app.get("/api/state", (req, res) => {
  res.json({
    products,
    orders,
    returnRequests,
    customers,
    messages,
    axsoCredentials,
    axsoSyncLogs
  });
});

// Save AXSO credentials
app.post("/api/axso/save", (req, res) => {
  const { shopDomain, apiToken, webhookSecret } = req.body;
  axsoCredentials = {
    shopDomain: shopDomain || "maison-elite.axso.shop",
    apiToken: apiToken || "",
    webhookSecret: webhookSecret || "",
    isConnected: !!shopDomain && !!apiToken
  };

  axsoSyncLogs.push({
    timestamp: new Date().toISOString(),
    type: "info",
    message: `Identifiants AXSO mis à jour pour la boutique ${axsoCredentials.shopDomain}. Connexion : ${axsoCredentials.isConnected ? "Active" : "Désactivée"}`
  });

  res.json({ success: true, axsoCredentials, axsoSyncLogs });
});

// Re-sync with AXSO (Simulates real-time GraphQL inventory sync)
app.post("/api/axso/sync", (req, res) => {
  axsoSyncLogs.push({
    timestamp: new Date().toISOString(),
    type: "graphql",
    message: "Starting full catalog inventory reconciliation query { products(first: 50) { edges { node { id title variants { edges { node { sku inventoryQuantity } } } } } } }"
  });

  // Reconcile and optimize stock slightly
  products.forEach(p => {
    if (p.stock < p.safetyStock) {
      // simulate online reorder/sync which helps restock
      p.stock += 2;
      updateProductStatus(p);
    }
  });

  axsoSyncLogs.push({
    timestamp: new Date().toISOString(),
    type: "sync",
    message: `Synchronisation du catalogue terminée. 5 fiches produits AXSO mises à jour en temps réel.`
  });

  res.json({ success: true, products, axsoSyncLogs });
});

// Simulate AXSO real-time webhook events (orders/create or refunds/create)
app.post("/api/axso/simulate-webhook", (req, res) => {
  const { eventType } = req.body; // 'orders/create' | 'refunds/create'

  if (eventType === 'orders/create') {
    // Generate a new premium order
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const newOrderId = `CMD-2026-AXSO-${Math.floor(100 + Math.random() * 900)}`;
    const price = randomProduct.price;
    const quantity = 1;
    const total = price * quantity;

    const newOrder: Order = {
      id: newOrderId,
      customerId: randomCustomer.id,
      customerName: randomCustomer.name,
      date: new Date().toISOString().split('T')[0],
      items: [
        { productId: randomProduct.id, productName: randomProduct.name, quantity, price }
      ],
      status: "Processing",
      total
    };

    orders.unshift(newOrder);

    // Update customer lifetime value
    randomCustomer.totalSpent += total;
    randomCustomer.ordersCount += 1;
    randomCustomer.customerLifetimeValue += total;

    // Decr stock
    if (randomProduct.stock > 0) {
      randomProduct.stock -= 1;
      updateProductStatus(randomProduct);
    }

    axsoSyncLogs.push({
      timestamp: new Date().toISOString(),
      type: "webhook",
      message: `WEBHOOK REÇU : Event 'orders_create' traité pour la commande ${newOrderId} (${randomCustomer.name}) - Montant: ${total} €`
    });

    const msg: Message = {
      id: `msg_axso_order_${Date.now()}`,
      sender: "system",
      text: `[Notification Webhook AXSO] Nouvelle commande ${newOrderId} passée en ligne par ${randomCustomer.name}. Produit : ${randomProduct.name} - Total : ${total} €.`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    messages.push(msg);

    return res.json({ success: true, type: "order", order: newOrder, products, customers, orders, messages, axsoSyncLogs });
  } else if (eventType === 'refunds/create') {
    // Create a return request from an existing processing/delivered order
    const activeOrders = orders.filter(o => o.status !== 'Returned');
    if (activeOrders.length === 0) {
      return res.status(400).json({ error: "Aucune commande active disponible pour simuler un retour." });
    }
    const targetOrder = activeOrders[0];
    const targetItem = targetOrder.items[0];
    const newReturnId = `RET-2026-AXSO-${Math.floor(10 + Math.random() * 90)}`;

    const newReturn: ReturnRequest = {
      id: newReturnId,
      orderId: targetOrder.id,
      customerId: targetOrder.customerId,
      customerName: targetOrder.customerName,
      date: new Date().toISOString().split('T')[0],
      status: "Pending",
      items: [
        { productId: targetItem.productId, productName: targetItem.productName, quantity: targetItem.quantity, refundAmount: targetItem.price * targetItem.quantity }
      ],
      reason: "Demande de retour initiée par le client depuis l'espace client AXSO. Motif: Changement d'avis, le style ne correspond pas pleinement aux attentes de prestige.",
      aiEligibilityScore: 92,
      aiExplanation: "Retour dans les délais de 14 jours réglementaires de AXSO. Client VIP avec un excellent historique d'achat. Éligibilité élevée à un remboursement.",
      refundProcessed: false,
      restocked: false
    };

    returnRequests.unshift(newReturn);

    axsoSyncLogs.push({
      timestamp: new Date().toISOString(),
      type: "webhook",
      message: `WEBHOOK REÇU : Event 'refunds_create' / 'return_request' pour le retour ${newReturnId} de la commande ${targetOrder.id}`
    });

    const msg: Message = {
      id: `msg_axso_return_${Date.now()}`,
      sender: "system",
      text: `[Notification Webhook AXSO] Demande de retour ${newReturnId} soumise en ligne pour la commande ${targetOrder.id} (${targetOrder.customerName}). Analyse d'éligibilité IA en cours.`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    messages.push(msg);

    return res.json({ success: true, type: "return", returnRequest: newReturn, returnRequests, messages, axsoSyncLogs });
  }

  res.status(400).json({ error: "Type d'événement webhook non supporté" });
});

// Manual action: trigger restocking of a product
app.post("/api/stock/reorder", (req, res) => {
  const { productId, quantity } = req.body;
  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: "Produit non trouvé" });
  }

  product.stock += quantity;
  updateProductStatus(product);

  const msg: Message = {
    id: `msg_reorder_${Date.now()}`,
    sender: "system",
    text: `Réapprovisionnement ordonné : +${quantity} unités pour ${product.name}. Stock actuel : ${product.stock}.`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };
  messages.push(msg);

  res.json({ success: true, product, messages });
});

// Manual action: approve or reject a return request
app.post("/api/returns/evaluate", (req, res) => {
  const { returnId, decision, shouldRestock } = req.body; // decision: 'Approved' | 'Rejected'
  const request = returnRequests.find(r => r.id === returnId);
  if (!request) {
    return res.status(404).json({ error: "Demande de retour non trouvée" });
  }

  request.status = decision;
  if (decision === 'Approved') {
    request.refundProcessed = true;
    
    // Update customer stats
    const customer = customers.find(c => c.id === request.customerId);
    if (customer) {
      customer.totalSpent -= request.items.reduce((sum, item) => sum + item.refundAmount, 0);
      customer.sentiment = "Delighted"; // They got refunded!
    }

    // Process restocking if requested
    if (shouldRestock) {
      request.restocked = true;
      request.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          prod.stock += item.quantity;
          updateProductStatus(prod);
        }
      });
    }
  }

  const msg: Message = {
    id: `msg_return_${Date.now()}`,
    sender: "system",
    text: `Demande de retour ${request.id} évaluée : ${decision === 'Approved' ? 'Approuvée' : 'Rejetée'}.`,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };
  messages.push(msg);

  res.json({ success: true, request, products, customers, messages });
});

// API endpoint to draft and test AI supplier orders directly
app.post("/api/ai/draft-supplier-email", async (req, res) => {
  const { productId, supplierName } = req.body;
  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: "Produit non trouvé" });
  }

  if (!ai) {
    return res.json({
      email: `Objet : Commande de réapprovisionnement urgente - ${product.name}\n\nMadame, Monsieur (Atelier ${supplierName}),\n\nNous constatons une baisse critique de stock pour l'article ${product.name} (SKU: ${product.sku}).\nNous souhaitons passer commande pour un réapprovisionnement rapide de 15 unités.\n\nCordialement,\nService Logistique AXSO`
    });
  }

  try {
    const prompt = `Rédige un e-mail professionnel et très élégant à notre fournisseur haut de gamme "${supplierName}" pour commander du réapprovisionnement pour le produit suivant :\nNom : ${product.name}\nSKU: ${product.sku}\nCatégorie: ${product.category}\nStock actuel : ${product.stock} (le stock de sécurité est de ${product.safetyStock}, nous sommes donc en rupture ou sous tension).\nLe ton doit refléter l'ultra haut de gamme d'une grande maison française, courtois mais ferme sur les délais. Propose de commander 15 unités.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le responsable logistique bilingue et raffiné d'une maison de luxe française. Tu écris un e-mail parfait.",
      }
    });

    res.json({ email: response.text });
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: "Erreur lors de la génération de l'e-mail par l'IA" });
  }
});

// API endpoint to test client manual support responses
app.post("/api/ai/draft-customer-reply", async (req, res) => {
  const { customerId, ticketMessage } = req.body;
  const customer = customers.find(c => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ error: "Client non trouvé" });
  }

  if (!ai) {
    return res.json({
      reply: `Chère Madame de Montaigne,\n\nNous vous remercions infiniment pour votre message. Nous mettons tout en œuvre pour répondre à votre demande concernant notre service avec le prestige que vous méritez.\n\nNotre conciergerie dédiée vous recontactera immédiatement.\n\nSincères salutations,\nAXSO`
    });
  }

  try {
    const prompt = `Rédige une réponse d'assistance client personnalisée, ultra haut de gamme et d'un raffinement absolu pour le client suivant :\nNom : ${customer.name}\nStatut : ${customer.loyaltyTier}\nTotal dépensé : ${customer.totalSpent}€\nSentiment actuel : ${customer.sentiment}\n\nLe message du client ou sa problématique est :\n"${ticketMessage}"\n\nRédige une réponse sur-mesure de Conciergerie de Luxe, en français, chaleureuse, qui résout le problème ou propose une prise en charge immédiate avec prestige.`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le directeur de la Conciergerie de Luxe d'une grande maison française. Ton langage est extrêmement élégant, poli, sur-mesure et rassurant.",
      }
    });

    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: "Erreur lors de la génération de la réponse client" });
  }
});

// API endpoint to draft WhatsApp or Gmail follow-ups
app.post("/api/ai/draft-followup", async (req, res) => {
  const { customerId, channel, scenario, productName } = req.body;
  const customer = customers.find(c => c.id === customerId) || customers[0];

  if (!ai) {
    const defaultResponse = channel === 'whatsapp' 
      ? `💬 *AXSO Conciergerie*\n\nBonjour M./Mme *${customer.name}*,\n\nNous avons remarqué que vous aviez un œil sur notre collection d'exception, notamment l'article *${productName || "notre sélection d'art"}*. Les pièces s'envolent rapidement.\n\nSouhaitez-vous un accès prioritaire ou un conseil privé ? Répondez directement à ce message.\n\n_L'équipe AXSO_`
      : `Subject: Invitation Exclusive & Sélection Personnalisée - AXSO\n\nCher(e) ${customer.name},\n\nNous avons le plaisir de vous contacter personnellement de la part d'AXSO.\n\nEn tant que membre privilégié de notre cercle de connaisseurs, nous tenions à attirer votre attention sur nos créations récentes qui résonnent avec votre goût pour l'excellence.\n\nNous restons à votre entière disposition pour planifier un appel privé ou une présentation en salon privé.\n\nSincères salutations,\nLa Direction AXSO`;
    return res.json({ text: defaultResponse });
  }

  try {
    let scenarioText = "";
    if (scenario === 'abandoned_cart') {
      scenarioText = `relancer le client par rapport à un panier d'exception abandonné contenant le produit "${productName || "de haute horlogerie/maroquinerie"}". Offre-lui un conseil privé sans brader l'image de marque (pas de réduction vulgaire, mais un service de personnalisation ou livraison prioritaire).`;
    } else if (scenario === 'vip_birthday') {
      scenarioText = `souhaiter un anniversaire mémorable de la part de la marque avec élégance et lui proposer un cadeau de fidélité ou un accès exclusif à notre nouvel atelier d'artisanat d'art.`;
    } else if (scenario === 'loyalty_cross_sell') {
      scenarioText = `le remercier pour sa fidélité et lui proposer un produit complémentaire haut de gamme assorti à ses précédents achats d'une valeur totale de ${customer.totalSpent}€.`;
    } else {
      scenarioText = `l'inviter personnellement à notre prochain showroom privé exclusif et virtuel pour découvrir la nouvelle collection en avant-première mondiale.`;
    }

    let prompt = "";
    if (channel === 'whatsapp') {
      prompt = `Rédige une relance WhatsApp d'exception pour le client suivant :\nNom : ${customer.name}\nStatut : ${customer.loyaltyTier}\nSentiment actuel : ${customer.sentiment}\n\nLe but est de ${scenarioText}\n\nFormat de rédaction WhatsApp :\n- Reste court, percutant et extrêmement distingué.\n- Utilise des émojis raffinés et sobres (comme ⚡, ✨, ⚜️, 💬, 📦) avec parcimonie.\n- Utilise le formatage WhatsApp (*gras* pour les mots clés importants, _italique_ pour les signatures, retours à la ligne élégants).\n- Ton chaleureux et personnalisé. Rédige en français de prestige.`;
    } else {
      prompt = `Rédige un e-mail Gmail de relance de prestige et de haute conversion pour le client suivant :\nNom : ${customer.name}\nStatut : ${customer.loyaltyTier}\nSentiment actuel : ${customer.sentiment}\nTotal dépensé : ${customer.totalSpent}€\n\nLe but est de ${scenarioText}\n\nFormat de rédaction Gmail :\n- Commence obligatoirement par "Subject: [Objet chic de l'e-mail]"\n- Puis fais un double saut de ligne et écris le corps de l'e-mail.\n- Langage d'un raffinement et d'une politesse extrêmes, digne de la haute couture ou de la haute joaillerie française.\n- Structure claire et aérée.\n- Formule de politesse personnalisée et signature prestigieuse d'AXSO. Rédige en français d'exception.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le Directeur de la Relation Client & du Clienteling d'Exception chez AXSO. Tu maîtrises l'art d'écrire des messages de relance extrêmement engageants, chics, percutants et à très haut taux de conversion.",
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error("Gemini Follow-up Draft Error:", err);
    res.status(500).json({ error: "Erreur lors de la génération de la relance" });
  }
});

// API endpoint to find winning products (millionaire product finder)
app.post("/api/ai/find-winning-product", async (req, res) => {
  if (!ai) {
    return res.json({
      name: "Le Chronographe Astral - Édition Céleste",
      tagline: "Le temps sculpté dans une météorite lunaire.",
      category: "Horlogerie",
      cogs: 280,
      retailPrice: 3400,
      margin: 91.7,
      targetAudience: "Investisseurs crypto, cadres supérieurs, collectionneurs d'objets astronomiques rares (35-55 ans).",
      marketingAngle: "L'exclusivité ultime d'un cadran taillé directement dans une véritable météorite certifiée, couplé à un mouvement automatique de prestige.",
      cpc: 1.45,
      conversionRate: 2.1,
      pathToMillionaire: "1. Importer 10 pièces en flux tendu chez l'horloger partenaire.\n2. Lancer des publicités vidéo haute fidélité montrant l'analyse de la météorite sur Instagram & TikTok (budget 1500€/mois).\n3. À un taux de conversion de 2%, 1500 clics génèrent 30 ventes de 3400€ = 102 000€ de CA.\n4. Réinvestir 50% des bénéfices dans le scaling publicitaire mondial.\n5. En 5 mois, vous dépassez le cap du million d'euros net avec moins de 400 clients VIP."
    });
  }

  try {
    const prompt = `Génère un concept de produit d'exception ultra-rentable (High-Ticket/High-Margin Winning Product) pour notre e-commerce de prestige. Le produit doit avoir un coût de fabrication/acquisition faible à moyen, mais une valeur perçue phénoménale permettant de le vendre à un prix de luxe (prestige pricing), dégageant plus de 80% de marge brute.
    
    Tu dois répondre sous la forme d'un objet JSON contenant exactement ces clés textuelles :
    - "name": (Nom prestigieux du produit, en français)
    - "tagline": (Slogan captivant et poétique)
    - "category": (Horlogerie, Maroquinerie, Parfumerie, Bijouterie, Accessoires d'Art...)
    - "cogs": (Coût de revient estimé en euros, nombre entier réaliste entre 50 et 300)
    - "retailPrice": (Prix de vente conseillé de luxe en euros, nombre entier réaliste entre 800 et 5000)
    - "margin": (Marge brute calculée en pourcentage, nombre décimal)
    - "targetAudience": (Description de la clientèle cible fortunée et réceptive)
    - "marketingAngle": (L'angle psychologique de copywriting et de rareté qui va déclencher l'achat impulsif de luxe)
    - "cpc": (Coût par clic moyen estimé sur Meta/Google Ads, nombre décimal entre 0.5 et 3.0)
    - "conversionRate": (Taux de conversion estimé sur la boutique de prestige, nombre décimal entre 1.0 et 5.0)
    - "pathToMillionaire": (Plan étape par étape précis en 5 points pour scaler ce produit vers le million d'euros net en moins de 6 mois avec AXSO et la publicité digitale)

    Réponds uniquement par le JSON brut sans balise markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le plus grand analyste de tendances e-commerce de luxe au monde, un 'Product Finder' de génie pour les e-commerçants voulant devenir multi-millionnaires par la valeur perçue et le prestige. Tu ne génères que des concepts d'une élégance et d'une rentabilité folles, au format JSON brut.",
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text);
    res.json(parsed);
  } catch (err) {
    console.error("Gemini Find Winning Product Error:", err);
    res.status(500).json({ error: "Erreur lors du brainstorming de produit gagnant par l'IA" });
  }
});

// API endpoint to generate product images
app.post("/api/ai/generate-product-image", async (req, res) => {
  const { productName, style, category } = req.body;

  let imageUrl = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=600";
  const lowerName = productName.toLowerCase();
  
  if (lowerName.includes("chrono") || lowerName.includes("montre") || lowerName.includes("watch")) {
    imageUrl = "https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&q=80&w=600";
  } else if (lowerName.includes("sac") || lowerName.includes("bag") || lowerName.includes("cabas")) {
    imageUrl = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=600";
  } else if (lowerName.includes("parfum") || lowerName.includes("perfume") || lowerName.includes("oud") || lowerName.includes("essence")) {
    imageUrl = "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=600";
  } else if (lowerName.includes("lunette") || lowerName.includes("soleil") || lowerName.includes("glasses") || lowerName.includes("sun")) {
    imageUrl = "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=600";
  } else if (lowerName.includes("echarpe") || lowerName.includes("soie") || lowerName.includes("scarf") || lowerName.includes("cachemire")) {
    imageUrl = "https://images.unsplash.com/photo-1584030373081-f37b7bb4fa8e?auto=format&fit=crop&q=80&w=600";
  } else {
    // Elegant fallback based on hash seed to stay beautiful and repeatable
    const hash = productName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seeds = [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&q=80&w=600",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600"
    ];
    imageUrl = seeds[hash % seeds.length];
  }

  if (!ai) {
    return res.json({
      imageUrl,
      prompt: `Un rendu studio ultra haut de gamme pour "${productName}" dans un style "${style}". Éclairage dramatique de trois points, reflets subtils sur une surface en marbre noir d'Italie, profondeur de champ cinématique, photoréaliste 8K.`,
      specifications: `Rapport de Rendu AXIA Studio :\n- **Nom de l'article :** ${productName}\n- **Directives Artistiques :** Style ${style}\n- **Matériaux Détectés :** Texture premium, finitions précieuses.\n- **Éclairage recommandé :** Réflecteur latéral doré doux et halo arrière pour dessiner la silhouette de l'objet.`
    });
  }

  try {
    const prompt = `Génère un rapport de conception et d'analyse visuelle ultra haut de gamme de niveau luxe pour un produit nommé "${productName}" (catégorie: "${category || 'Luxe'}"), dans le style de rendu de studio "${style}".\nRédige une description poétique et artistique de l'image qui aurait été générée (qui correspond à un rendu photoréaliste prestigieux de grande marque), décrivant l'ambiance, les jeux de lumière, les reflets et les matériaux nobles de l'objet.\nGénère également l'invite de génération d'image (le prompt) parfaite en anglais pour concevoir ce produit.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le Directeur Artistique principal de l'agence AXIA Créative. Ton écriture est extrêmement raffinée, poétique, axée sur l'esthétique du luxe et la perfection visuelle.",
      }
    });

    res.json({
      imageUrl,
      prompt: `An ultra-luxury product shot of ${productName}, style: ${style}, high-end commercial advertising photography, dramatic soft chiaroscuro lighting, material textures like gold and polished obsidian, elegant professional composition, 8k resolution.`,
      specifications: response.text
    });
  } catch (err) {
    console.error("Gemini Product Image Gen Error:", err);
    res.status(500).json({ error: "Erreur lors de l'analyse artistique du produit" });
  }
});

// API endpoint to redesign a boutique from an image and a theme
app.post("/api/ai/redesign-boutique", async (req, res) => {
  const { theme, referenceStyle } = req.body;

  let redesignedImageUrl = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800";
  
  if (theme.includes("Scandinave") || theme.includes("Minimaliste")) {
    redesignedImageUrl = "https://images.unsplash.com/photo-1567401373180-9892b1444485?auto=format&fit=crop&q=80&w=800";
  } else if (theme.includes("Dorée") || theme.includes("Haute Couture")) {
    redesignedImageUrl = "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&q=80&w=800";
  } else if (theme.includes("Rococo") || theme.includes("Or")) {
    redesignedImageUrl = "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800";
  } else {
    redesignedImageUrl = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800";
  }

  if (!ai) {
    return res.json({
      redesignedImageUrl,
      manifesto: `Manifeste de Redesign Spatial AXIA :\n\nNous avons restructuré l'espace de vente selon le concept de **"${theme}"**.\n\n1. **Architecture & Volumes :** Élimination des cloisons restrictives pour un flux de circulation fluide et intuitif. Les hauteurs sous plafond sont accentuées par des dômes de lumière naturelle.\n2. **Matériaux Sélectionnés :** Marbre veiné blanc de Carrare, finitions en laiton brossé et dalles de pierre de Bourgogne au sol. Les portants de présentation adoptent des lignes ultra-fines pour sublimer les silhouettes.\n3. **Ambiance Lumineuse :** Température de couleur calibrée à 2700K (lumière chaude de fin d'après-midi) avec des spots directionnels encastrés à faisceau étroit sur les pièces phares.\n4. **Conversion Commerciale :** Une disposition bento du mobilier central ralentit le client et augmente de 24% le temps d'exposition visuelle aux accessoires de haute maroquinerie.`
    });
  }

  try {
    const prompt = `En tant qu'architecte d'intérieur et designer d'espace de prestige pour les flagships de luxe, rédige un rapport de redesign d'une boutique haut de gamme à partir d'un concept thématique de style "${theme}".\nLe style de référence demandé par le marchand est "${referenceStyle}".\nStructure ton rapport en plusieurs sections magnifiques :\n- Concept & Philosophie du Design (poétique)\n- Palette de Matériaux Nobles et Éclairage\n- Optimisation de l'Ergonomie de Vente et de la conversion E-commerce physique.\n\nSois extrêmement précis, utilise des termes architecturaux d'exception en français.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le designer d'intérieur en chef de Maison AXIA Studio. Ton écriture est extraordinaire, sophistiquée, digne des plus grands cabinets d'architecture de l'avenue Montaigne.",
      }
    });

    res.json({
      redesignedImageUrl,
      manifesto: response.text
    });
  } catch (err) {
    console.error("Gemini Boutique Redesign Error:", err);
    res.status(500).json({ error: "Erreur lors de la génération du plan de redesign spatial" });
  }
});

// API endpoint to generate marketing campaigns
app.post("/api/ai/generate-campaign", async (req, res) => {
  const { campaignName, platform, audience, productId, budget } = req.body;
  const product = products.find(p => p.id === productId) || products[0];

  let mockupUrl = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600";
  if (product.id === "p1") mockupUrl = "https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&q=80&w=600";
  if (product.id === "p2") mockupUrl = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=600";
  if (product.id === "p3") mockupUrl = "https://images.unsplash.com/photo-1584030373081-f37b7bb4fa8e?auto=format&fit=crop&q=80&w=600";
  if (product.id === "p4") mockupUrl = "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&q=80&w=600";
  if (product.id === "p5") mockupUrl = "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=600";

  if (!ai) {
    return res.json({
      mockupUrl,
      headline: `L'Élégance Signature - ${product.name}`,
      primaryText: `Découvrez l'exception au quotidien avec le ${product.name}. Façonné à la main dans nos ateliers historiques à partir de matériaux d'une noblesse absolue, ce chef-d'œuvre incarne l'alliance parfaite entre tradition séculaire et design contemporain.`,
      description: "Disponible en édition limitée. Livraison sécurisée offerte.",
      visualPrompt: `Une mise en scène de luxe du ${product.name} sur fond de drapé de satin sombre avec une ombre douce de persienne. Esthétique épurée, contrastes profonds, logo ornemental raffiné en filigrane.`,
      suggestedBudget: `Budget journalier recommandé : ${(budget / 30).toFixed(2)}€ sur 30 jours.\n- Ciblage prioritaire : ${audience}\n- CPC estimé : 1.25€\n- ROI ciblé : 4.8x`,
      keywords: ["luxe", "prestige", "artisanat français", product.name.toLowerCase(), "connaisseur", "maison elite"]
    });
  }

  try {
    const prompt = `Rédige une campagne publicitaire e-commerce prestigieuse pour le produit suivant :\n- Produit : ${product.name} (SKU: ${product.sku}, Prix: ${product.price}€)\n- Nom de la campagne : "${campaignName}"\n- Réseau social / Support : ${platform}\n- Audience cible : ${audience}\n- Budget mensuel : ${budget} €\n\nTu devez générer un objet JSON contenant exactement ces clés textuelles :\n- "headline" (un titre accrocheur, élégant et court)\n- "primaryText" (un texte publicitaire narratif, captivant et poétique, rédigé en français haut de gamme)\n- "description" (une ligne de réassurance ou de call to action chic)\n- "visualPrompt" (des consignes artistiques de prise de vue pour le photographe de la campagne)\n- "suggestedBudget" (un conseil stratégique de répartition du budget et de prédiction du ROI de manière raffinée)\n- "keywords" (un tableau de 5 à 6 mots-clés performants en minuscule)\n\nRéponds uniquement par le JSON brut sans balise markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "Tu es le Directeur de la Stratégie Média et du Copywriting chez AXIA Marketing. Tu rédiges avec un soin extrême et réponds toujours au format JSON brut.",
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text);
    res.json({
      mockupUrl,
      ...parsed
    });
  } catch (err) {
    console.error("Gemini Campaign Gen Error:", err);
    // Return high quality fallback on parse error
    res.json({
      mockupUrl,
      headline: `L'Incomparable ${product.name}`,
      primaryText: `Faites l'expérience du prestige absolu. Notre collection d'exception célèbre le savoir-faire de la haute manufacture française.`,
      description: "Collection exclusive AXSO. Réservation privée.",
      visualPrompt: `Visuel épuré centré sur le produit avec un éclairage de contre-jour enveloppant. Teintes sobres, or et noir profond.`,
      suggestedBudget: `Budget mensuel de ${budget}€ alloué à 70% sur l'audience "${audience}". ROI escompté de 5.2x basé sur l'historique de la marque.`,
      keywords: ["luxe", "axso", product.name.toLowerCase(), "haute manufacture"]
    });
  }
});

// ---------------------------------------------------------
// CORE AI CHAT & DECISION ENGINE (Gemini Function Calling)
// ---------------------------------------------------------
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message requis" });
  }

  // Create a tracking log for executed tool
  let toolExecuted: any = null;

  // Add the user message to global log
  const userMsg: Message = {
    id: `msg_user_${Date.now()}`,
    sender: "user",
    text: message,
    timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  };
  messages.push(userMsg);

  if (!ai) {
    // Elegant fallback mock simulation when no API key is set
    setTimeout(() => {
      let replyText = "Je suis l'assistant AXIA. En mode simulation hors-ligne, je peux traiter vos demandes de manière globale : gestion automatisée des retours, analyse intelligente des stocks, service client personnalisé d'exception, génération d'images de produits, design de boutique ou encore création de campagnes marketing haut de gamme. Que puis-je faire pour parfaire notre e-commerce aujourd'hui ?";
      
      // Basic rule matching for offline mode to feel functional
      const lower = message.toLowerCase();
      if (lower.includes("stock") || lower.includes("inventaire") || lower.includes("réapprovisionner")) {
        const outItems = products.filter(p => p.stock <= p.safetyStock);
        replyText = `J'ai analysé l'état des stocks. Nous avons actuellement ${outItems.length} articles en alerte : ` + 
          outItems.map(i => `${i.name} (Stock: ${i.stock})`).join(", ") + `. Souhaitez-vous que je rédige un e-mail de commande au fournisseur ?`;
      } else if (lower.includes("retour") || lower.includes("rembourser") || lower.includes("rembourse")) {
        replyText = "La gestion automatique des retours est opérationnelle. Notre IA évalue la demande d'Amélie Dubois sur la commande CMD-2026-103 avec un score d'éligibilité de 88% en raison du défaut signalé. Souhaitez-vous que je valide le remboursement et réapprovisionne l'article ?";
      } else if (lower.includes("vip") || lower.includes("client") || lower.includes("hélène")) {
        replyText = "Hélène de Montaigne est notre cliente Platinum VIP. Elle a dépensé plus de 18 000€ chez nous. Je vous conseille de lui réserver un accueil personnalisé et de lui offrir un cadeau de fidélité lors de sa prochaine commande.";
      } else if (lower.includes("image") || lower.includes("génè") || lower.includes("photo")) {
        replyText = "Je peux concevoir des rendus visuels sublimes de niveau studio pour n'importe quel produit dans notre catalogue ou de nouveaux concepts. Veuillez utiliser l'onglet 'Studio Visuel AXIA' pour lancer une génération, ou dites-moi quel produit vous inspire.";
      } else if (lower.includes("campagne") || lower.includes("pub") || lower.includes("marketing")) {
        replyText = "La gestion de campagnes marketing est disponible dans l'onglet dédié 'Campagnes'. Je peux rédiger des textes accrocheurs de copywriting de luxe et prévoir la stratégie de budget.";
      } else if (lower.includes("boutique") || lower.includes("design") || lower.includes("magasin")) {
        replyText = "Notre service d'architecte d'intérieur IA est disponible ! Sélectionnez 'Studio Visuel AXIA' puis l'option 'Design de Boutique' pour restructurer virtuellement l'agencement d'un flagship store.";
      }

      const agentMsg: Message = {
        id: `msg_agent_${Date.now()}`,
        sender: "agent",
        text: replyText,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      };
      messages.push(agentMsg);

      return res.json({
        reply: replyText,
        state: { products, orders, returnRequests, customers, messages }
      });
    }, 500);
    return;
  }

  try {
    // Define tool declarations for Gemini
    const tools = [
      {
        functionDeclarations: [
          {
            name: "getInventory",
            description: "Récupère l'état complet du catalogue de produits, les niveaux de stock, les prix et les fournisseurs.",
            parameters: { type: Type.OBJECT, properties: {} }
          },
          {
            name: "restockProduct",
            description: "Commande du stock supplémentaire pour un produit en cas de rupture de stock ou alerte.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                productId: { type: Type.STRING, description: "L'identifiant du produit (ex: p1, p2)" },
                quantity: { type: Type.INTEGER, description: "La quantité à commander (ex: 15, 20)" }
              },
              required: ["productId", "quantity"]
            }
          },
          {
            name: "processReturnApproval",
            description: "Approuve automatiquement ou rejette une demande de retour client en calculant sa légitimité et gérant le remboursement.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                returnId: { type: Type.STRING, description: "L'identifiant du retour (ex: RET-2026-01)" },
                decision: { type: Type.STRING, description: "La décision ('Approved' ou 'Rejected')" },
                shouldRestock: { type: Type.BOOLEAN, description: "Si l'article doit être remis en stock" }
              },
              required: ["returnId", "decision", "shouldRestock"]
            }
          },
          {
            name: "getCustomerProfile",
            description: "Recherche un profil client par son nom ou son ID pour obtenir son statut VIP, ses dépenses et son historique.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                searchQuery: { type: Type.STRING, description: "Le nom ou l'identifiant du client" }
              },
              required: ["searchQuery"]
            }
          },
          {
            name: "getOrderDetails",
            description: "Récupère les détails d'une commande spécifique par son identifiant (ex: CMD-2026-101) ou recherche l'historique des commandes d'un client par son identifiant (ex: c1, c2) pour pouvoir répondre de manière contextuelle et personnalisée sur les colis, livraisons, retours et commandes.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                orderId: { type: Type.STRING, description: "L'identifiant de commande précis à analyser (ex: CMD-2026-101, CMD-2026-102)" },
                customerId: { type: Type.STRING, description: "L'identifiant du client pour lister toutes ses commandes (ex: c1, c2)" }
              }
            }
          }
        ]
      }
    ];

    // Format conversational history for Gemini
    const systemInstruction = `Tu es AXIA, l'intelligence artificielle conversationnelle ultra haut de gamme et la conciergerie IA de la prestigieuse maison d'e-commerce "AXSO".
Ton rôle est de piloter cette plateforme e-commerce d'une main de maître et de répondre aux questions du gestionnaire ou des clients d'exception.
Tu t'adresses de manière extrêmement polie, distinguée et professionnelle.
Tu as le pouvoir d'analyser les stocks, de gérer de manière automatisée et autonome les retours de marchandises, d'obtenir des données personnalisées sur nos clients VIP, et d'accéder aux informations détaillées de commandes pour fournir des réponses contextuelles d'un raffinement absolu.
Reste toujours courtois, élégant, fluide et réactif.
Quand on te demande d'agir, utilise les fonctions mises à ta disposition. Une fois qu'une fonction est appelée, explique clairement ses impacts logistiques et financiers.
Si un dossier ou un client demande un remboursement ou des détails sur une livraison, consulte l'historique de ses commandes avec getOrderDetails pour pouvoir lui répondre avec une précision chirurgicale (numéro de suivi, transporteur, articles exacts).`;

    const chatContents = history ? history.map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    })) : [];

    // Add current context data directly into the prompt to ensure Gemini has accurate and fresh context
    const currentContextString = `CONTEXTE ACTUEL DU SYSTÈME (BASE DE DONNÉES EN DIRECT):
- Produits : ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, stock: p.stock, safetyStock: p.safetyStock, price: p.price, status: p.status })))}
- Retours en attente : ${JSON.stringify(returnRequests.filter(r => r.status === 'Pending'))}
- Clients VIP : ${JSON.stringify(customers.map(c => ({ id: c.id, name: c.name, loyaltyTier: c.loyaltyTier, sentiment: c.sentiment })))}`;

    chatContents.push({
      role: "user",
      parts: [{ text: `${currentContextString}\n\nREQUÊTE DE L'UTILISATEUR:\n${message}` }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: chatContents,
      config: {
        systemInstruction,
        tools,
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    let textResponse = response.text || "";
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args as any;

      if (call.name === "getInventory") {
        toolExecuted = {
          name: "getInventory",
          description: "Consultation de l'inventaire en temps réel",
          status: "success",
          data: `${products.length} articles répertoriés.`
        };
        textResponse = `J'ai extrait l'état de notre inventaire pour vous. Nous avons ${products.filter(p => p.status !== 'Optimal').length} articles nécessitant notre attention (en rupture ou sous le stock de sécurité). Comment préférez-vous agir ?`;
      } 
      else if (call.name === "restockProduct") {
        const prod = products.find(p => p.id === args.productId);
        if (prod) {
          prod.stock += args.quantity;
          updateProductStatus(prod);
          toolExecuted = {
            name: "restockProduct",
            description: `Réapprovisionnement de ${prod.name}`,
            status: "success",
            data: `+${args.quantity} unités commandées.`
          };
          
          // Inject a system log
          messages.push({
            id: `sys_log_${Date.now()}`,
            sender: "system",
            text: `Réapprovisionnement automatique ordonné par l'IA : +${args.quantity} unités pour ${prod.name}.`,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          });

          textResponse = `J'ai pris l'initiative d'ordonner un réapprovisionnement de **${args.quantity} unités** pour notre superbe **${prod.name}** auprès de son fournisseur. Son niveau de stock est désormais de **${prod.stock} unités**, ce qui nous remet en conformité de sécurité. Un e-mail de commande officiel a été préparé en coulisses.`;
        } else {
          textResponse = `Je regrette, mais je n'ai pas pu identifier le produit avec la référence "${args.productId}" pour passer la commande de réapprovisionnement.`;
        }
      } 
      else if (call.name === "processReturnApproval") {
        const reqRet = returnRequests.find(r => r.id === args.returnId);
        if (reqRet) {
          reqRet.status = args.decision;
          if (args.decision === 'Approved') {
            reqRet.refundProcessed = true;
            const customer = customers.find(c => c.id === reqRet.customerId);
            if (customer) {
              customer.totalSpent -= reqRet.items.reduce((sum, item) => sum + item.refundAmount, 0);
              customer.sentiment = "Delighted";
            }
            if (args.shouldRestock) {
              reqRet.restocked = true;
              reqRet.items.forEach(item => {
                const p = products.find(prod => prod.id === item.productId);
                if (p) {
                  p.stock += item.quantity;
                  updateProductStatus(p);
                }
              });
            }
          }

          toolExecuted = {
            name: "processReturnApproval",
            description: `Évaluation retour ${args.returnId}`,
            status: "success",
            data: `Retour ${args.decision === 'Approved' ? 'Approuvé' : 'Rejeté'}. Réintégration stock: ${args.shouldRestock ? 'Oui' : 'Non'}`
          };

          // Inject system log
          messages.push({
            id: `sys_log_${Date.now()}`,
            sender: "system",
            text: `Traitement de retour IA : ${args.returnId} est ${args.decision === 'Approved' ? 'approuvé' : 'rejeté'}.`,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          });

          textResponse = `Conformément à nos standards d'excellence, j'ai analysé et **${args.decision === 'Approved' ? 'approuvé' : 'rejeté'}** la demande de retour de notre client **${reqRet.customerName}** (Référence ${args.returnId}). Le remboursement de l'article a été crédité instantanément, et j'ai ${args.shouldRestock ? "ordonné la réintégration immédiate de l'article dans notre stock d'exception" : "mis l'article de côté pour inspection qualité"}.`;
        } else {
          textResponse = `Je n'ai pas pu localiser le dossier de retour associé à la référence "${args.returnId}". Pouvez-vous vérifier la validité de l'identifiant ?`;
        }
      } 
      else if (call.name === "getCustomerProfile") {
        const query = args.searchQuery.toLowerCase();
        const customer = customers.find(c => c.name.toLowerCase().includes(query) || c.id.toLowerCase() === query);
        if (customer) {
          toolExecuted = {
            name: "getCustomerProfile",
            description: `Extraction profil ${customer.name}`,
            status: "success",
            data: `Statut ${customer.loyaltyTier}`
          };
          textResponse = `J'ai extrait la fiche confidentielle de notre cliente d'exception **${customer.name}** :
- **Statut de Fidélité :** ${customer.loyaltyTier}
- **Volume d'achat cumulé :** ${customer.totalSpent} € (${customer.ordersCount} commandes prestigieuses)
- **Sentiment client actuel :** ${customer.sentiment === 'Delighted' ? 'Enchantée (Très positif) ✨' : customer.sentiment === 'Neutral' ? 'Neutre ⚖️' : 'Insatisfaite (À privilégier) ⚠️'}

Son profil indique un attachement profond aux finitions soignées. Que puis-je faire pour parfaire son expérience ?`;
        } else {
          textResponse = `Je n'ai pas trouvé de profil correspondant à la requête "${args.searchQuery}" dans notre registre de clients privilégiés.`;
        }
      }
      else if (call.name === "getOrderDetails") {
        const orderIdArg = args.orderId;
        const customerIdArg = args.customerId;
        let detailsText = "";
        
        if (orderIdArg) {
          const ord = orders.find(o => o.id === orderIdArg || o.id.toLowerCase() === orderIdArg.toLowerCase());
          if (ord) {
            toolExecuted = {
              name: "getOrderDetails",
              description: `Détails commande ${ord.id}`,
              status: "success",
              data: `Total ${ord.total}€`
            };
            detailsText = `J'ai localisé la commande **${ord.id}** pour le client **${ord.customerName}** (Passée le ${ord.date}) :
- **Articles :** ${ord.items.map(i => `${i.quantity}x ${i.productName} (${i.price} €/u)`).join(", ")}
- **Montant Total :** ${ord.total} €
- **Statut de livraison :** ${ord.status === 'Delivered' ? 'Livrée avec succès (Prestige Courier)' : ord.status === 'Shipped' ? 'En cours de transit (DHL)' : 'En cours de préparation dans nos ateliers'}`;
          } else {
            detailsText = `Je n'ai pas pu trouver de commande correspondante pour la référence **${orderIdArg}**.`;
          }
        } else if (customerIdArg) {
          const custOrders = orders.filter(o => o.customerId === customerIdArg);
          const customer = customers.find(c => c.id === customerIdArg);
          if (customer) {
            toolExecuted = {
              name: "getOrderDetails",
              description: `Historique commandes ${customer.name}`,
              status: "success",
              data: `${custOrders.length} commandes`
            };
            detailsText = `Voici l'historique des commandes prestigieuses pour notre cliente d'exception **${customer.name}** :
${custOrders.map(o => `- **Commande ${o.id}** (${o.date}) : ${o.total} € • Statut : *${o.status === 'Delivered' ? 'Livrée' : o.status === 'Shipped' ? 'Expédiée' : 'En préparation'}*`).join("\n")}`;
          } else {
            detailsText = `Je n'ai pas pu trouver de client avec l'identifiant **${customerIdArg}**.`;
          }
        } else {
          detailsText = "Veuillez spécifier un identifiant de commande ou un identifiant de client pour que je puisse consulter les informations logistiques.";
        }
        textResponse = detailsText;
      }
    }

    // Append agent message to system memory
    const agentMsg: Message = {
      id: `msg_agent_${Date.now()}`,
      sender: "agent",
      text: textResponse,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      toolExecuted
    };
    messages.push(agentMsg);

    res.json({
      reply: textResponse,
      state: { products, orders, returnRequests, customers, messages }
    });

  } catch (err: any) {
    console.error("Gemini Conversational Agent Error:", err);
    
    // Smooth fallback error presentation
    const errorMsgText = "Je rencontre un léger contretemps technique avec le serveur de traitement neuronal. Veuillez m'en excuser. Je reste disponible en mode simulation.";
    const agentMsg: Message = {
      id: `msg_agent_err_${Date.now()}`,
      sender: "agent",
      text: errorMsgText,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    messages.push(agentMsg);

    res.json({
      reply: errorMsgText,
      state: { products, orders, returnRequests, customers, messages }
    });
  }
});

// ---------------------------------------------------------
// VITE DEV SERVER OR PRODUCTION SERVING SETUP
// ---------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("🚀 Vite middleware injected successfully (Development Mode)");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("📦 Serving compiled production files from /dist");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✨ AXIA Console Engine running beautifully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
