#!/usr/bin/env node
// Appdex MCP server — iOS App Store revenue & download estimates for Claude Desktop / Cursor / any MCP host.
//
// Thin HTTP client over the public Appdex API v1 (https://app-dex.com/api/v1).
// The estimation engine (DuckDB + anchor-calibrated model) runs server-side; this file only maps
// MCP tool calls to HTTP requests and formats the answer for an agent to read.
//
// SETUP
//   APPDEX_API_KEY=adx_...            (get one at https://app-dex.com/account)
//   APPDEX_API_URL=https://app-dex.com  (optional; defaults to production)
//
// TIERS: free = ranges + confidence label (50 req/day) · paid = point estimates, chart rank, $/install.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Eski adlar (APPINTEL_*) geriye-uyumlu okunur — mevcut kurulumlar kırılmasın.
const BASE = (process.env.APPDEX_API_URL || process.env.APPINTEL_API_URL || "https://app-dex.com").replace(/\/$/, "");
const KEY = process.env.APPDEX_API_KEY || process.env.APPINTEL_API_KEY || "";

const NO_KEY_MSG =
  "Appdex API anahtarı yok. https://app-dex.com/account adresinden ücretsiz anahtar alın, " +
  "sonra MCP yapılandırmanıza APPDEX_API_KEY=adx_... ekleyin.";

async function api(path) {
  if (!KEY) throw new Error(NO_KEY_MSG);
  const r = await fetch(`${BASE}${path}`, {
    headers: { accept: "application/json", authorization: `Bearer ${KEY}` },
  });
  const quota = {
    used: r.headers.get("x-quota-used"),
    limit: r.headers.get("x-quota-limit"),
    tier: r.headers.get("x-quota-tier"),
  };
  if (r.status === 401) throw new Error("Anahtar geçersiz. https://app-dex.com/account adresinden yeni anahtar alın.");
  if (r.status === 429) {
    const b = await r.json().catch(() => ({}));
    throw new Error(`Günlük kota doldu (${b.used ?? "?"}/${b.limit ?? "?"}, ${b.tier ?? "free"}). ${b.hint ?? ""}`);
  }
  if (!r.ok) throw new Error(`Appdex API ${r.status} — ${path}`);
  const body = await r.json();
  return { body, quota };
}

const text = (o) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
const fail = (e) => ({ content: [{ type: "text", text: `Hata: ${e.message}` }], isError: true });
const quotaNote = (q) => (q.limit ? `${q.used}/${q.limit} istek kullanıldı (${q.tier} katman)` : undefined);

const server = new McpServer({ name: "appdex", version: "1.0.1" });

// ⭐ ANA TOOL — bir iOS app'in aylık geliri/indirmesi, güven etiketiyle.
server.registerTool("estimate_app", {
  title: "Estimate an iOS app's revenue & downloads",
  description:
    "Bir iOS app için aylık TAHMİNİ gelir ve indirme sayısını güven etiketiyle döndürür " +
    "(verified = gerçek veri · calibrated = doğrulanmış panele kalibre · modeled = sınırlı sinyal). " +
    "App adı veya numeric App Store id kabul eder. Ücretsiz katman aralık verir; ücretli katman " +
    "nokta-tahmin, ABD chart sırası ve indirme-başına-gelir ekler.",
  inputSchema: {
    query: z.string().describe("App adı (ör. 'Duolingo') veya App Store id (ör. 570060128)"),
  },
}, async ({ query }) => {
  try {
    let id = String(query).trim();
    if (!/^\d{6,}$/.test(id)) {
      const s = await api(`/api/v1/search?q=${encodeURIComponent(id)}&limit=1`);
      const hit = s.body.results?.[0];
      if (!hit) return text(`"${query}" için app bulunamadı.`);
      id = String(hit.appId);
    }
    const { body: d, quota } = await api(`/api/v1/app?id=${id}`);
    if (!d.found) return text(`App bulunamadı (id: ${id}).`);
    return text({
      app: d.name,
      developer: d.developer,
      category: d.category,
      rating: d.rating != null ? `${Number(d.rating).toFixed(2)} (${d.ratingCount ?? "?"} oy)` : null,
      monthly_revenue: d.monthlyRevenue?.estimate ?? d.monthlyRevenue?.range ?? null,
      monthly_downloads: d.monthlyDownloads?.estimate ?? d.monthlyDownloads?.range ?? null,
      confidence: d.monthlyRevenue?.confidence ?? null,
      revenue_per_install: d.revenuePerInstall ?? undefined,   // yalnız ücretli katman
      us_chart: d.usChart ?? undefined,                        // yalnız ücretli katman
      report_url: d.url,
      tier: d.tier,
      note: d.note ?? "Tahmindir; her rakam güven aralığıyla birlikte okunmalıdır.",
      quota: quotaNote(quota),
    });
  } catch (e) { return fail(e); }
});

server.registerTool("search_apps", {
  title: "Find an iOS app id by name",
  description:
    "App Store kataloğunda isim/geliştiriciye göre app arar ve App Store id'lerini döndürür. " +
    "estimate_app'e vermek üzere id çözmek için kullanın. Rakam döndürmez.",
  inputSchema: {
    query: z.string().describe("Aranacak app veya geliştirici adı"),
    limit: z.number().optional().default(5).describe("Sonuç sayısı (ücretsiz katmanda en fazla 5)"),
  },
}, async ({ query, limit }) => {
  try {
    const { body, quota } = await api(`/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return text({
      results: (body.results || []).map((r) => ({ id: r.appId, name: r.name, developer: r.developer, category: r.category })),
      tier: body.tier,
      quota: quotaNote(quota),
    });
  } catch (e) { return fail(e); }
});

// NOT: top_charts / market_overview / niches / keyword_density / keyword_explorer tool'ları
// API v1 bu uçları yayınlayana kadar KALDIRILDI — var olmayan uca çağrı yapan bir tool,
// ajanı yanlış yönlendirir ve her denemede hata döndürür. Uçlar eklendiğinde geri gelecekler.

await server.connect(new StdioServerTransport());
console.error(`Appdex MCP ready → ${BASE}${KEY ? "" : "  ⚠ APPDEX_API_KEY yok — araçlar anahtar isteyecek"}`);
