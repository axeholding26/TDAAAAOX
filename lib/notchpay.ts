// Client API NotchPay — paiements mobile money africains (remplace Stripe/Flutterwave/CinetPay/Campay/Chariow)
// Docs: https://developer.notchpay.co — fetch brut, pas de SDK tiers non officiel.
import crypto from "crypto";

const NOTCHPAY_BASE = "https://api.notchpay.co";

function headers(withGrant = false) {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: process.env.NOTCHPAY_PUBLIC_KEY ?? "",
  };
  if (withGrant) h["X-Grant"] = process.env.NOTCHPAY_PRIVATE_KEY ?? "";
  return h;
}

export function hasNotchPay(): boolean {
  return !!(process.env.NOTCHPAY_PUBLIC_KEY && process.env.NOTCHPAY_PRIVATE_KEY);
}

async function notchpayFetch(path: string, options: { method?: string; body?: any; withGrant?: boolean } = {}) {
  const res = await fetch(`${NOTCHPAY_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: headers(options.withGrant),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || data?.error || `NotchPay HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

// ─── Paiements ─────────────────────────────────────────────────────────────

export async function initierPaiementNotchPay(params: {
  amount: number;
  currency: string;
  email: string;
  name: string;
  phone?: string;
  description: string;
  reference: string;
  callback: string;
}): Promise<{ transaction: any; authorizationUrl: string }> {
  const data = await notchpayFetch("/payments", {
    method: "POST",
    withGrant: true,
    body: {
      amount: params.amount,
      currency: params.currency,
      customer: { name: params.name, email: params.email, phone: params.phone },
      description: params.description,
      reference: params.reference,
      callback: params.callback,
    },
  });
  return { transaction: data.transaction, authorizationUrl: data.authorization_url };
}

export async function verifierPaiementNotchPay(reference: string): Promise<{ transaction: any }> {
  const data = await notchpayFetch(`/payments/${encodeURIComponent(reference)}`, { withGrant: true });
  return { transaction: data.transaction };
}

// ─── Transferts (retraits wallet) ───────────────────────────────────────────

export async function initierTransfertNotchPay(params: {
  amount: number;
  currency: string;
  channel: string;
  beneficiaryData: {
    name: string;
    phone?: string;
    email?: string;
    account_number?: string;
    bank_code?: string;
    country?: string;
  };
  reference?: string;
  description?: string;
}): Promise<{ transfer: any }> {
  const data = await notchpayFetch("/transfers", {
    method: "POST",
    withGrant: true,
    body: {
      amount: params.amount,
      currency: params.currency,
      channel: params.channel,
      beneficiary_data: params.beneficiaryData,
      reference: params.reference,
      description: params.description,
    },
  });
  return { transfer: data.transfer };
}

export async function verifierTransfertNotchPay(id: string): Promise<{ transfer: any }> {
  const data = await notchpayFetch(`/transfers/${encodeURIComponent(id)}`, { withGrant: true });
  return { transfer: data.transfer };
}

// ─── Webhooks ────────────────────────────────────────────────────────────────

export function verifierSignatureWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.NOTCHPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
