// Capturas de la landing (public/landing/*.webp) sacadas de la app corriendo en local.
//
// Solo usa el plantel ficticio "Demo - Rugby" (adulta, sin menores ni datos reales). Antes de
// correrlo, sembrar la semana demo con scripts/landing/seed.sql (MCP de Supabase, execute_sql):
// deja entrenamientos lunes, martes y jueves, gimnasio el miércoles y partido el sábado con nómina.
// Conviene correrlo después del entrenamiento del lunes (18:00–19:30), para que el jugador tenga
// esa carga por registrar.
//
// Las contraseñas NO están en el repo: LANDING_PASSWORD es la contraseña común de las cuentas
// demo @recov.test.
//
//   LANDING_PASSWORD=… npm run landing:capturas                    → todas
//   LANDING_PASSWORD=… npm run landing:capturas -- --solo=hero-ipad-staff-resumen,staff-carga
//
// LANDING_URL: por defecto http://localhost:3000 (npm run dev). Salida: public/landing/<nombre>.webp,
// calidad ~75 y bajo 150 KB (si se pasa, baja la resolución).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium, devices, webkit, type Browser, type BrowserContext, type Locator, type Page } from "playwright";

const BASE = process.env.LANDING_URL ?? "http://localhost:3000";
const PASSWORD = process.env.LANDING_PASSWORD;
const OUT = path.resolve("public/landing");
const MAX_BYTES = 150 * 1024;
const solo = process.argv.find((a) => a.startsWith("--solo="))?.slice(7).split(",");

const CLUB_ID = "ae9bea22-0873-4748-91c0-a46dd6228a43"; // Demo - Rugby (ficticio)
const PLAN_GIMNASIO = "15ea1d71-4dd9-449f-8b9f-361baab30451"; // "Fuerza Plantel Completo"

// Cuentas ficticias del plantel demo (todas @recov.test).
const ACCOUNTS = {
  "head-coach": "hc.demo",
  kine: "kine.demo",
  "preparador-fisico": "pf.demo",
  jugador: "jugador.demo",
} as const;
type Role = keyof typeof ACCOUNTS;
type Device = "phone" | "ipad";

if (!PASSWORD) {
  console.error("Falta LANDING_PASSWORD (la contraseña común de las cuentas demo).");
  process.exit(1);
}

// WebKit (Safari) para el celular; el Chrome del sistema para el iPad: en WebKit la vista de
// escritorio deja una fuente sin terminar de cargar y la captura no llega a sacarse.
let browser: Browser;
let desktopBrowser: Browser | undefined;
const sessions = new Map<string, Page>();

async function session(role: Role, device: Device) {
  const key = `${role}:${device}`;
  const hit = sessions.get(key);
  if (hit) return hit;
  if (device === "ipad") desktopBrowser ??= await chromium.launch({ channel: "chrome" });
  const ctx: BrowserContext = await (device === "ipad" ? desktopBrowser! : browser).newContext({
    ...(device === "phone" ? devices["iPhone 14"] : {}),
    viewport: device === "phone" ? { width: 390, height: 844 } : { width: 1180, height: 820 },
    deviceScaleFactor: 2,
    locale: "es-CL",
    timezoneId: "America/Santiago",
    colorScheme: "light",
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("recov-install-dismissed", "1");
    } catch {}
    // Oculta el indicador de desarrollo de Next en las capturas.
    document.addEventListener("DOMContentLoaded", () => {
      const s = document.createElement("style");
      s.textContent = "nextjs-portal{display:none!important}";
      document.head.appendChild(s);
    });
  });
  const page = await ctx.newPage();
  // En `next dev` la primera visita a cada pantalla compila: se da margen.
  page.setDefaultTimeout(120000);
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("input[name=email]", `${ACCOUNTS[role]}@recov.test`);
  await page.fill("input[name=password]", PASSWORD!);
  await page.press("input[name=password]", "Enter");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120000 });
  await ctx.addCookies([
    { name: "recov_club", value: CLUB_ID, url: BASE },
    { name: "recov_format", value: "15", url: BASE },
  ]);
  // Tras el login la app aún puede estar redirigiendo: se espera y, si se cruza, se reintenta.
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await go(page, "/dashboard");
  if (!/Demo - Rugby/.test(await page.locator("body").innerText())) {
    throw new Error(`La cuenta ${role} no entró a Demo - Rugby`);
  }
  sessions.set(key, page);
  return page;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 5000))]));
  await page.waitForTimeout(600);
}

async function go(page: Page, url: string) {
  // Si la app redirige a la misma pantalla (p. ej. al fijar el plantel activo), Playwright avisa
  // que la navegación se cruzó: basta con esperar a que la segunda termine.
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" }).catch(async (e: Error) => {
    if (!/interrupted by another navigation/.test(e.message)) throw e;
    await page.waitForLoadState("domcontentloaded");
  });
  await settle(page);
}

/** Lleva un elemento a la parte de arriba de la pantalla, con un margen. */
async function top(page: Page, loc: Locator, margin = 12) {
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 });
  await loc.evaluate((el, m) => window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - m)), margin);
  await page.waitForTimeout(300);
}

async function click(p: Page, loc: Locator) {
  await loc.click();
  await settle(p);
}

/**
 * Celular: oculta el encabezado del club y la barra inferior de la app (solo en la captura, con
 * CSS inyectado) para que la pantalla muestre lo importante, sin chrome repetido.
 */
async function hideChrome(page: Page) {
  await page.addStyleTag({
    content: `
      header[class*="safe-area-inset-top"],
      nav[aria-label="Navegación principal"] { display: none !important; }
      html, body { scroll-behavior: auto !important; }
      /* Espacio extra al final para poder dejar arriba el foco aunque la pantalla sea corta. */
      body { padding-bottom: 100vh !important; }`,
  });
  await page.waitForTimeout(150);
}

/** Atajos para elegir el elemento que va arriba en cada captura. */
const heading = (p: Page, text: string | RegExp) => p.getByRole("heading", { name: text }).filter({ visible: true }).first();
const visibleText = (p: Page, text: string | RegExp) => p.getByText(text).filter({ visible: true }).first();

type Cap = {
  file: string;
  role: Role;
  device: Device;
  run: (p: Page) => Promise<void>;
  /** Elemento que queda arriba de la pantalla, con un margen en px (por defecto 24). */
  focus?: (p: Page) => Locator;
  margin?: number;
};
const caps: Cap[] = [
  { file: "hero-ipad-staff-resumen", role: "head-coach", device: "ipad", run: (p) => go(p, "/dashboard") },
  {
    file: "staff-resumen",
    role: "head-coach",
    device: "phone",
    run: (p) => go(p, "/dashboard"),
    focus: (p) => heading(p, "Disponibilidad del plantel"),
  },
  {
    file: "staff-lesiones",
    role: "kine",
    device: "phone",
    run: (p) => go(p, "/lesiones"),
  },
  {
    file: "staff-calendario",
    role: "head-coach",
    device: "phone",
    run: (p) => go(p, "/calendario"),
    focus: (p) => visibleText(p, /^lun, \d+ \w+ – dom/),
  },
  {
    file: "staff-partido",
    role: "head-coach",
    device: "phone",
    run: async (p) => {
      // Nómina del próximo partido en vista Cancha: titulares en sus puestos.
      await go(p, "/nominas");
      const id = await p.locator("a[href*='/disponibles']").first().getAttribute("href");
      if (!id) throw new Error("Sin nómina del próximo partido");
      await go(p, id);
      // Clic por JS: en `next dev` a veces una capa transparente intercepta el puntero.
      await p.getByRole("button", { name: "Cancha" }).filter({ visible: true }).first().evaluate((b) => (b as HTMLElement).click());
      await settle(p);
    },
    // El resumen de la nómina queda fijo arriba: el selector Lista | Cancha va justo debajo.
    focus: (p) => p.getByRole("group", { name: "Vista" }).filter({ visible: true }).first(),
    margin: 150,
  },
  {
    file: "staff-evaluaciones",
    role: "preparador-fisico",
    device: "phone",
    run: (p) => go(p, "/evaluaciones?tab=comparar"),
    focus: (p) => visibleText(p, /^Test$/),
    margin: 40,
  },
  {
    file: "staff-gimnasio",
    role: "preparador-fisico",
    device: "phone",
    run: (p) => go(p, `/planes/${PLAN_GIMNASIO}`),
    // La sesión: nombre, día y los bloques con sus ejercicios.
    focus: (p) => visibleText(p, /Sentadilla/),
    margin: 150,
  },
  {
    file: "staff-carga",
    role: "head-coach",
    device: "phone",
    run: (p) => go(p, "/metricas?tab=carga"),
    focus: (p) => heading(p, "Carga por jugador"),
  },
  {
    file: "jugador-resumen",
    role: "jugador",
    device: "phone",
    run: (p) => go(p, "/dashboard"),
    focus: (p) => visibleText(p, /^Tu estado$/),
    margin: 48,
  },
  {
    file: "jugador-registrar-lesion",
    role: "jugador",
    device: "phone",
    run: (p) => go(p, "/registrar-lesion"),
    focus: (p) => visibleText(p, /^Zona del cuerpo$/),
  },
  {
    file: "jugador-registrar-carga",
    role: "jugador",
    device: "phone",
    run: async (p) => {
      // El chip "N esfuerzo por responder" del Resumen abre el aviso que lleva a /reportar/[evento].
      await go(p, "/dashboard");
      await click(p, p.getByText(/esfuerzos? por responder/).first());
      const href = await p.locator("a[href^='/reportar/']").first().getAttribute("href");
      if (!href) throw new Error("El jugador no tiene carga por registrar (¿se sembró la semana demo?)");
      await go(p, href);
      // Elige un 7 sin guardar, para que se vea la escala marcada.
      await p.getByRole("button", { name: "Esfuerzo 7" }).first().click();
      await p.waitForTimeout(400);
    },
    focus: (p) => heading(p, /Qué tan duro fue/),
  },
  {
    file: "jugador-calendario",
    role: "jugador",
    device: "phone",
    run: (p) => go(p, "/calendario"),
    focus: (p) => visibleText(p, /^lun, \d+ \w+ – dom/),
  },
  {
    file: "jugador-evaluaciones",
    role: "jugador",
    device: "phone",
    run: (p) => go(p, "/evaluaciones"),
    focus: (p) => visibleText(p, /^Último resultado$/),
    margin: 40,
  },
  {
    file: "jugador-carga",
    role: "jugador",
    device: "phone",
    run: (p) => go(p, "/mi-carga"),
    focus: (p) => visibleText(p, /^Esta semana$/),
    margin: 40,
  },
];

async function saveWebp(png: Buffer, file: string) {
  const meta = await sharp(png).metadata();
  let width = meta.width!;
  for (;;) {
    const out = await sharp(png).resize({ width }).webp({ quality: 75, effort: 6 }).toBuffer();
    if (out.length <= MAX_BYTES || width < 400) {
      fs.writeFileSync(path.join(OUT, `${file}.webp`), out);
      const h = Math.round((meta.height! * width) / meta.width!);
      return { kb: Math.round(out.length / 1024), width, height: h };
    }
    width = Math.round(width * 0.9);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  browser = await webkit.launch();
  try {
    for (const c of caps) {
      if (solo && !solo.includes(c.file)) continue;
      const page = await session(c.role, c.device);
      await c.run(page);
      if (c.device === "phone") await hideChrome(page);
      if (c.focus) {
        await top(page, c.focus(page), c.margin ?? 24).catch(async () => {
          console.warn(`  ${c.file}: no encontré el elemento de foco; queda desde arriba`);
          await page.evaluate(() => window.scrollTo(0, 0));
        });
      }
      else await page.evaluate(() => window.scrollTo(0, 0));
      const png = await page.screenshot();
      const r = await saveWebp(png, c.file);
      console.log(`${c.file}.webp  ${r.width}×${r.height}  ${r.kb} KB  (${c.role})`);
    }
  } finally {
    await browser.close();
    await desktopBrowser?.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
