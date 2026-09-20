/**
 * Playwright browser session — singleton persistent via globalThis.
 * Survives Next.js hot-reloads. One browser, N pages (tabs).
 */

import type { Browser, BrowserContext, Page } from "playwright";

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
  favicon: string;
}

interface InternalTab extends BrowserTab {
  page: Page;
}

export const VIEWPORT = { width: 1280, height: 800 };

class PlaywrightSessionManager {
  private browser: Browser | null = null;
  private ctx: BrowserContext | null = null;
  private tabs = new Map<string, InternalTab>();
  private activeTabId: string | null = null;
  private counter = 0;
  public lastError: string | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async ensureBrowser(): Promise<void> {
    if (this.browser?.isConnected()) return;

    this.lastError = null;
    const { chromium } = await import("playwright");

    const BASE_ARGS = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1280,800",
    ];

    // Try system browsers first — no download needed
    // Edge is always present on Windows 10/11, Chrome if installed
    const CHANNELS = ["msedge", "chrome"] as const;
    for (const channel of CHANNELS) {
      try {
        this.browser = await chromium.launch({ headless: true, channel, args: BASE_ARGS });
        console.log(`[playwright] Launched with channel: ${channel}`);
        break;
      } catch {
        // Channel not available, try next
      }
    }

    // Last resort: bundled Chromium (requires successful download)
    if (!this.browser?.isConnected()) {
      try {
        this.browser = await chromium.launch({ headless: true, args: BASE_ARGS });
        console.log("[playwright] Launched with bundled Chromium");
      } catch (e: any) {
        this.lastError = `Impossible de démarrer le navigateur. Essayez d'installer Chrome ou Edge, ou relancez : npx playwright install chromium\n\nDétail : ${e.message}`;
        throw new Error(this.lastError);
      }
    }

    this.ctx = await this.browser.newContext({
      viewport: VIEWPORT,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      locale: "fr-FR",
      ignoreHTTPSErrors: true,
    });

    this.browser.on("disconnected", () => {
      this.browser = null;
      this.ctx = null;
      this.tabs.clear();
      this.activeTabId = null;
    });
  }

  private async syncTab(page: Page): Promise<void> {
    const tab = [...this.tabs.values()].find((t) => t.page === page);
    if (!tab) return;
    try {
      tab.url = page.url();
      tab.title = (await page.title().catch(() => "")) || new URL(page.url()).hostname || "Onglet";
      tab.favicon = await page
        .evaluate(() => {
          const el =
            (document.querySelector("link[rel~='icon']") ||
             document.querySelector("link[rel~='shortcut icon']") ||
             document.querySelector("link[rel='apple-touch-icon']")) as HTMLLinkElement | null;
          return el?.href || "";
        })
        .catch(() => "");
    } catch { /* page may have closed */ }
  }

  // ── Tab management ─────────────────────────────────────────────────────────

  async newTab(url = "https://www.google.com"): Promise<string> {
    await this.ensureBrowser();

    const page = await this.ctx!.newPage();
    const id = `tab_${++this.counter}`;

    const tab: InternalTab = { id, page, url: "about:blank", title: "Nouvel onglet", favicon: "" };
    this.tabs.set(id, tab);
    this.activeTabId = id;

    page.on("load",           () => this.syncTab(page).catch(() => {}));
    page.on("framenavigated", (f) => { if (f === page.mainFrame()) this.syncTab(page).catch(() => {}); });

    if (url && url !== "about:blank") {
      const normalized = url.startsWith("http") ? url : `https://${url}`;
      await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch((e) => {
        this.lastError = e.message;
      });
      await this.syncTab(page);
    }

    return id;
  }

  async closeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab) return;
    await tab.page.close().catch(() => {});
    this.tabs.delete(id);
    if (this.activeTabId === id) {
      const remaining = [...this.tabs.keys()];
      this.activeTabId = remaining.at(-1) ?? null;
    }
  }

  setActiveTab(id: string): void {
    if (this.tabs.has(id)) this.activeTabId = id;
  }

  getTabList(): BrowserTab[] {
    return [...this.tabs.values()].map(({ id, url, title, favicon }) => ({ id, url, title, favicon }));
  }

  getActiveTabId(): string | null { return this.activeTabId; }

  getActivePage(): Page | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId)?.page ?? null;
  }

  isReady(): boolean { return !!this.browser?.isConnected(); }

  // ── Screenshot ─────────────────────────────────────────────────────────────

  async screenshot(): Promise<string | null> {
    const page = this.getActivePage();
    if (!page) return null;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 80 });
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch { return null; }
  }

  // ── Navigate ───────────────────────────────────────────────────────────────

  async navigate(url: string): Promise<void> {
    const page = this.getActivePage();
    if (!page) return;
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    await page.goto(normalized, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => {});
    await this.syncTab(page);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async action(type: string, params: Record<string, any> = {}): Promise<void> {
    const page = this.getActivePage();
    if (!page) throw new Error("Aucun onglet actif");

    switch (type) {
      case "click":
        await page.mouse.click(params.x, params.y, { button: params.button || "left", clickCount: 1 });
        break;
      case "dblclick":
        await page.mouse.dblclick(params.x, params.y);
        break;
      case "move":
        await page.mouse.move(params.x, params.y);
        break;
      case "scroll":
        await page.mouse.wheel(params.deltaX ?? 0, params.deltaY ?? 120);
        break;
      case "type":
        await page.keyboard.type(String(params.text ?? ""), { delay: 25 });
        break;
      case "key":
        await page.keyboard.press(String(params.key ?? "Enter"));
        break;
      case "navigate":
        await this.navigate(String(params.url ?? ""));
        return;
      case "back":
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => {});
        break;
      case "forward":
        await page.goForward({ waitUntil: "domcontentloaded", timeout: 10_000 }).catch(() => {});
        break;
      case "reload":
        await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
        break;
      case "wait":
        await page.waitForTimeout(params.ms ?? 800);
        return;
    }

    await page.waitForTimeout(300).catch(() => {});
    await this.syncTab(page);
  }

  // ── Destroy ────────────────────────────────────────────────────────────────

  async destroy(): Promise<void> {
    await this.browser?.close().catch(() => {});
    this.browser = null;
    this.ctx = null;
    this.tabs.clear();
    this.activeTabId = null;
  }

  get viewport() { return VIEWPORT; }
}

// ── Global singleton ───────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __pwSession: PlaywrightSessionManager | undefined;
}

if (!globalThis.__pwSession) {
  globalThis.__pwSession = new PlaywrightSessionManager();
}

export const pwSession = globalThis.__pwSession;
