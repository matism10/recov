import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import { anchorId } from "./anchors.ts";
import { PERMISSIONS, rolePermissions } from "./permissions.ts";
import {
  SEARCH_INDEX,
  searchDestinations,
  visibleDestinations,
  type SearchContext,
  type SearchRule,
} from "./search-index.ts";
import { highlightParts, scoreMatch } from "./search-match.ts";

const ROOT = process.cwd();
const APP = join(ROOT, "src/app");
const MIGRATIONS = join(ROOT, "supabase/migrations");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Copias sueltas del tipo "page 2.tsx" no son parte de la app.
const isStray = (f: string) => / \d\.[a-z]+$/.test(f);
const appFiles = walk(APP).filter((f) => /\.tsx?$/.test(f) && !isStray(f));
const read = (f: string) => readFileSync(f, "utf8");

// --- Rutas reales: cada page.tsx sin grupos "(x)"; los segmentos [x] aceptan cualquier valor.
const routes = appFiles
  .filter((f) => f.endsWith("/page.tsx"))
  .map((f) => "/" + relative(APP, f).slice(0, -"/page.tsx".length).split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/"))
  .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));
const matchesRoute = (path: string) =>
  routes.some((r) => {
    const a = r.split("/");
    const b = path.split("/");
    return a.length === b.length && a.every((seg, i) => /^\[.*\]$/.test(seg) || seg === b[i]);
  });

// Fuentes de la pantalla de una ruta: todo lo que hay bajo su carpeta de primer nivel
// (los bloques de Métricas, además, toman su id del título: ver MetricsBlock).
const sourcesUnder = (path: string) => {
  const top = path.split("/")[1] ?? "";
  const dir = join(APP, top);
  return appFiles.filter((f) => f.startsWith(dir + "/")).map(read).join("\n");
};
const metricHeadings = appFiles
  .filter((f) => f.includes("/metricas/"))
  .flatMap((f) => [...read(f).matchAll(/heading\s*=\s*"([^"]+)"/g)].map((m) => m[1]));
const metricAnchors = new Set(metricHeadings.map(anchorId));

const rulePerms = (rule: SearchRule): string[] => {
  if (typeof rule === "string") return [];
  if ("perm" in rule) return [rule.perm].flat();
  if ("all" in rule) return rule.all.flatMap(rulePerms);
  if ("any" in rule) return rule.any.flatMap(rulePerms);
  return [];
};

describe("índice: cada entrada apunta a algo que existe", () => {
  it("ids únicos", () => {
    const ids = SEARCH_INDEX.map((d) => d.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("cada href corresponde a una ruta de src/app", () => {
    for (const d of SEARCH_INDEX) {
      const path = d.href.split(/[?#]/)[0];
      assert.ok(matchesRoute(path), `${d.id}: la ruta ${path} no existe`);
    }
  });

  it("cada ancla existe en la pantalla a la que lleva", () => {
    for (const d of SEARCH_INDEX) {
      const anchor = d.href.split("#")[1];
      if (!anchor) continue;
      const path = d.href.split(/[?#]/)[0];
      const inScreen = new RegExp(`["'\`]${anchor}["'\`]`).test(sourcesUnder(path));
      const inMetrics = path === "/metricas" && metricAnchors.has(anchor);
      assert.ok(inScreen || inMetrics, `${d.id}: no se encontró el id "${anchor}" en ${path}`);
    }
  });

  it("cada pestaña (?tab=) existe en la pantalla", () => {
    for (const d of SEARCH_INDEX) {
      const tab = /[?&]tab=([a-z]+)/.exec(d.href)?.[1];
      if (!tab) continue;
      const path = d.href.split(/[?#]/)[0];
      assert.ok(new RegExp(`["'\`]${tab}["'\`]`).test(sourcesUnder(path)), `${d.id}: no existe la pestaña ${tab}`);
    }
  });

  it("cada permiso existe en el catálogo (código y migraciones)", () => {
    const migrations = walk(MIGRATIONS)
      .filter((f) => f.endsWith(".sql") && !isStray(f))
      .map(read)
      .join("\n");
    for (const d of SEARCH_INDEX) {
      for (const perm of rulePerms(d.requires)) {
        assert.ok((PERMISSIONS as readonly string[]).includes(perm), `${d.id}: ${perm} no está en PERMISSIONS`);
        assert.ok(migrations.includes(`'${perm}'`), `${d.id}: ${perm} no está en las migraciones`);
      }
    }
  });

  it("lo que solo se dibuja con datos tiene estado vacío", () => {
    // Secciones del índice que dependían de tener datos: ahora siempre se ven.
    // Los bloques del Resumen del staff viven en estos archivos.
    const dashboard = ["dashboard/page.tsx", "dashboard/staff-blocks.tsx", "dashboard/zones-card.tsx"]
      .map((f) => read(join(APP, f)))
      .join("\n");
    assert.ok(dashboard.includes("No hay lesiones abiertas con zona registrada"), "Zonas lesionadas sin estado vacío");
    assert.ok(dashboard.includes("No hay lesiones por revisar."), "Por revisar sin estado vacío");
    assert.ok(dashboard.includes("No hay jugadores lesionados ni en reintegro."), "Lesiones activas sin estado vacío");
    const lesiones = read(join(APP, "lesiones/(lista)/page.tsx"));
    assert.ok(lesiones.includes("No hay lesiones actuales") && lesiones.includes("Aún no hay lesiones en el historial"));
  });
});

// Títulos visibles de pantallas estáticas (SectionTitle, h2 y bloques de Métricas, con texto
// fijo). Cada uno debe estar en el índice o en esta lista, con su motivo. Las pantallas con
// [id] (fichas, evento, plan) no tienen una ruta fija: se llega desde un resultado o desde
// el calendario, y quedan fuera de la auditoría.
const EXCEPTIONS: Record<string, string> = {
  // Solo se dibujan con datos (sin estado vacío): ofrecerlas podría llevar a algo que no se ve.
  "Del plantel": "Mis ausencias: solo si hay un parón o aviso del plantel",
  "Mis partidos": "Resumen del jugador: solo con ficha y carga de partidos",
  "Disponibilidad en el tiempo": "Resumen: depende de las métricas que eligió la dirección",
  "Próximos partidos": "Nóminas: solo si hay partidos por jugar",
  "Partidos jugados": "Nóminas: solo si hay partidos jugados",
  "Último resultado": "Mis evaluaciones: solo con un test cargado",
  "Tu progreso": "Mis evaluaciones: solo con varios resultados",
  "Ranking del plantel": "Mis evaluaciones: solo con un test cargado",
  // Títulos de estados vacíos, ventanas y banners (no son secciones a las que ir).
  "Aún no hay tests en el plantel": "estado vacío de Evaluaciones",
  "Declarar ausencia": "ventana de Ausencias (se abre desde ese botón)",
  "Elige tu posición en Sevens": "aviso temporal del Resumen y Plantel",
  "Buscar jugadores y secciones": "título accesible del propio buscador",
  // Contenido principal de una pantalla que ya se ofrece como destino.
  "Activas y próximas": "contenido de Mis ausencias (ya ofrecida)",
  "Staff": "lista de la pantalla Staff (ya ofrecida)",
  "Entrenamiento": "bloque dentro del editor de Nuevo plan (ya ofrecido)",
};

describe("índice: cada sección con título está ofrecida o justificada", () => {
  const skipDirs = ["/(landing)/", "/c/", "/login/", "/recuperar/", "/restablecer/", "/aceptar-terminos/", "/activar-plantel/", "/pendiente/", "/privacidad/", "/terminos/"];
  const files = appFiles.filter((f) => {
    const rel = "/" + relative(APP, f);
    return !rel.includes("[") && !skipDirs.some((d) => rel.includes(d)) && !/\/(loading|skeleton)\.tsx$/.test(rel);
  });
  const found = new Map<string, string>();
  for (const f of files) {
    const src = read(f);
    const patterns = [
      /<SectionTitle[^>]*>\s*([^<{}]+?)\s*<\/SectionTitle>/g,
      /<h2[^>]*>\s*([^<{}]+?)\s*<\/h2>/g,
      /<CardHeader[^>]*?\btitle="([^"]+)"/g,
      /heading\s*=\s*"([^"]+)"/g,
    ];
    for (const re of patterns) for (const m of src.matchAll(re)) found.set(m[1].replace(/\s+/g, " "), relative(ROOT, f));
  }
  const offered = new Set(SEARCH_INDEX.map((d) => d.title));

  it("hay títulos que auditar", () => {
    assert.ok(found.size > 20, `solo se encontraron ${found.size} títulos`);
  });

  it("cada título visible está en el índice o en las excepciones", () => {
    const missing = [...found].filter(([t]) => !offered.has(t) && !(t in EXCEPTIONS));
    assert.deepEqual(missing, [], "títulos sin cubrir: " + missing.map(([t, f]) => `"${t}" (${f})`).join(", "));
  });

  it("las excepciones siguen existiendo y no están ofrecidas", () => {
    for (const t of Object.keys(EXCEPTIONS)) {
      assert.ok(found.has(t), `la excepción "${t}" ya no existe en pantalla`);
      assert.ok(!offered.has(t), `"${t}" está en el índice: quitar la excepción`);
    }
  });
});

// --- Por persona: lo que se ofrece es lo que puede abrir. Los permisos salen de la plantilla
// de cada rol (lo mismo que la base sin ajustes). Los ids son los del índice.
function persona(roles: string[], extra: Partial<SearchContext> = {}): SearchContext {
  const permissions = [...rolePermissions(roles)];
  const staff = roles.some((r) => r !== "jugador");
  const evaluations = roles.some((r) => ["head_coach", "kinesiologo", "entrenador", "nutricionista", "preparador_fisico"].includes(r));
  return { roles, permissions, staff, evaluations, sport: "rugby", hasSevens: true, mobile: true, ...extra };
}
const ids = (ctx: SearchContext) => new Set(visibleDestinations(ctx).map((d) => d.id));

const STAFF_ONLY = ["lesiones-activas", "zonas", "metricas", "minutos", "asistencia-bloque", "carga-jugador", "evaluaciones", "planes", "staff", "registros", "configuracion"];
const PLAYER_ONLY = ["mis-lesiones", "registrar-lesion", "mis-evaluaciones", "mi-plan", "plan-propia", "bienestar", "ausencias", "ausencia-nueva", "perfil-contacto"];
const EVERYONE = ["resumen", "mi-semana", "calendario", "plantel", "nominas", "asistencia", "perfil", "perfil-foto", "perfil-datos", "perfil-cuenta", "cerrar-sesion", "privacidad", "terminos"];

describe("por persona", () => {
  it("todos ven lo común", () => {
    for (const roles of [["head_coach"], ["kinesiologo"], ["entrenador"], ["manager"], ["preparador_fisico"], ["jugador"]]) {
      const v = ids(persona(roles));
      for (const id of EVERYONE) assert.ok(v.has(id), `${roles}: falta ${id}`);
    }
  });

  it("jugador: solo lo suyo, nada de staff", () => {
    const v = ids(persona(["jugador"]));
    for (const id of PLAYER_ONLY) assert.ok(v.has(id), `jugador: falta ${id}`);
    for (const id of [...STAFF_ONLY, "evento-nuevo", "avisos-staff", "por-revisar", "armar-nomina", "config-bienestar", "metricas-carga", "metricas-lesiones"]) {
      assert.ok(!v.has(id), `jugador no debe ver ${id}`);
    }
    // Sus lesiones, sí; el resto de la sección Lesiones es suya también.
    assert.ok(v.has("lesiones") && v.has("lesiones-actuales"));
  });

  it("head coach: todo lo de staff y nada de jugador", () => {
    const v = ids(persona(["head_coach"]));
    for (const id of [...STAFF_ONLY, "evento-nuevo", "avisos-staff", "por-revisar", "armar-nomina", "evaluaciones-cargar", "config-resumen", "config-sevens", "grupo-sevens", "perfil-barra"]) {
      assert.ok(v.has(id), `head coach: falta ${id}`);
    }
    for (const id of PLAYER_ONLY) assert.ok(!v.has(id), `head coach no debe ver ${id}`);
  });

  it("kinesiólogo: revisa lesiones y carga tests; no gestiona staff ni planes", () => {
    const v = ids(persona(["kinesiologo"]));
    for (const id of ["por-revisar", "lesiones", "zonas", "metricas", "evaluaciones", "evaluaciones-cargar", "avisos-staff"]) assert.ok(v.has(id), `kine: falta ${id}`);
    for (const id of ["staff", "registros", "configuracion", "planes", "evento-nuevo", "armar-nomina", "config-logo", "grupo-sevens"]) assert.ok(!v.has(id), `kine no debe ver ${id}`);
  });

  it("entrenador: eventos y lista; no revisa lesiones ni arma nóminas", () => {
    const v = ids(persona(["entrenador"]));
    for (const id of ["evento-nuevo", "avisos-staff", "lesiones-activas", "metricas", "evaluaciones", "evaluaciones-comparar"]) assert.ok(v.has(id), `entrenador: falta ${id}`);
    for (const id of ["por-revisar", "armar-nomina", "evaluaciones-cargar", "planes", "staff", "registros", "configuracion"]) assert.ok(!v.has(id), `entrenador no debe ver ${id}`);
  });

  it("manager: dirección sin lesiones clínicas ni evaluaciones", () => {
    const v = ids(persona(["manager"]));
    for (const id of ["staff", "registros", "configuracion", "config-logo", "config-sevens", "grupo-sevens", "armar-nomina", "evento-nuevo", "config-bienestar"]) assert.ok(v.has(id), `manager: falta ${id}`);
    for (const id of ["por-revisar", "evaluaciones", "evaluaciones-cargar", "planes", "config-resumen", "mis-lesiones"]) assert.ok(!v.has(id), `manager no debe ver ${id}`);
  });

  it("preparador físico: planes, tests y días del check; en Configuración solo el check", () => {
    const v = ids(persona(["preparador_fisico"]));
    for (const id of ["planes", "plan-nuevo", "evaluaciones-cargar", "configuracion", "config-bienestar", "metricas-carga"]) assert.ok(v.has(id), `preparador: falta ${id}`);
    for (const id of ["config-logo", "config-portada", "config-partidos", "config-sevens", "config-resumen", "staff", "registros", "evento-nuevo", "por-revisar"]) assert.ok(!v.has(id), `preparador no debe ver ${id}`);
  });

  it("el delegado de la kine (permiso efectivo) ve Por revisar sin ser kine", () => {
    const base = persona(["entrenador"]);
    assert.ok(!ids(base).has("por-revisar"));
    assert.ok(ids({ ...base, permissions: [...base.permissions, "lesiones_revisar"] }).has("por-revisar"));
  });

  it("el permiso quitado a una persona esconde el destino aunque su rol lo tenga", () => {
    const base = persona(["head_coach"]);
    const v = ids({ ...base, permissions: base.permissions.filter((p) => p !== "carga_ver") });
    assert.ok(!v.has("metricas-carga") && !v.has("carga-jugador"));
    assert.ok(v.has("metricas-lesiones"));
    const none = ids({ ...base, permissions: base.permissions.filter((p) => p !== "carga_ver" && p !== "lesiones_ver") });
    assert.ok(!none.has("metricas"));
  });

  it("depende del club: sin rugby ni Sevens no hay esas secciones; en escritorio no hay barra inferior", () => {
    const hc = persona(["head_coach"]);
    assert.ok(!ids({ ...hc, sport: "futbol", hasSevens: false }).has("config-sevens"));
    assert.ok(ids({ ...hc, hasSevens: false }).has("config-sevens") && !ids({ ...hc, hasSevens: false }).has("grupo-sevens"));
    assert.ok(!ids({ ...hc, mobile: false }).has("perfil-barra"));
  });
});

describe("búsqueda", () => {
  const ctx = persona(["head_coach"]);
  it("sin tildes ni mayúsculas y por sinónimos", () => {
    assert.equal(searchDestinations("ZONAS", ctx)[0]?.id, "zonas");
    assert.equal(searchDestinations("donde", ctx)[0]?.id, "zonas");
    assert.equal(searchDestinations("nómina", ctx)[0]?.id, "nominas");
    assert.ok(searchDestinations("paron", ctx).some((d) => d.id === "carga-jugador"));
  });
  it("palabras sueltas en cualquier orden y máximo 5", () => {
    assert.ok(searchDestinations("jugador carga", ctx).some((d) => d.id === "carga-jugador"));
    assert.ok(searchDestinations("e", ctx).length <= 5);
    assert.equal(searchDestinations("xyzqq", ctx).length, 0);
  });
  it("scoreMatch y resaltado", () => {
    assert.equal(scoreMatch("Martín", [], "zzz"), null);
    assert.deepEqual(highlightParts("Martín Pérez", "martin"), [
      { text: "Martín", hit: true },
      { text: " Pérez", hit: false },
    ]);
  });
});
