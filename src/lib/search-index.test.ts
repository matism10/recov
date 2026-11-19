import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { PERMISSIONS } from "./permissions.ts";
import { SEARCH_INDEX, searchDestinations, visibleDestinations, type SearchRule } from "./search-index.ts";
import { highlightParts, scoreMatch } from "./search-match.ts";

const APP = join(process.cwd(), "src/app");
const MIGRATIONS = join(process.cwd(), "supabase/migrations");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Rutas reales: cada page.tsx sin grupos "(x)"; los segmentos [x] aceptan cualquier valor.
// Los duplicados "page 2.tsx" (copias sueltas) no cuentan.
const routes = walk(APP)
  .filter((f) => f.endsWith("/page.tsx"))
  .map((f) => "/" + f.slice(APP.length + 1, -"/page.tsx".length).split("/").filter((s) => !/^\(.*\)$/.test(s)).join("/"))
  .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")));
const matchesRoute = (path: string) =>
  routes.some((r) => {
    const a = r.split("/");
    const b = path.split("/");
    return a.length === b.length && a.every((seg, i) => /^\[.*\]$/.test(seg) || seg === b[i]);
  });

const sources = walk(APP)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const rulePerms = (rule: SearchRule) => (typeof rule === "object" && "perm" in rule ? [rule.perm].flat() : []);

describe("índice del buscador", () => {
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

  it("cada ancla existe en alguna pantalla", () => {
    for (const d of SEARCH_INDEX) {
      const anchor = d.href.split("#")[1];
      if (!anchor) continue;
      assert.ok(new RegExp(`["'\`]${anchor}["'\`]`).test(sources), `${d.id}: no se encontró el id "${anchor}"`);
    }
  });

  it("cada permiso existe en el catálogo (código y migraciones)", () => {
    const migrations = walk(MIGRATIONS)
      .filter((f) => f.endsWith(".sql") && !/ \d\.sql$/.test(f))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    for (const d of SEARCH_INDEX) {
      for (const perm of rulePerms(d.requires)) {
        assert.ok((PERMISSIONS as readonly string[]).includes(perm), `${d.id}: ${perm} no está en PERMISSIONS`);
        assert.ok(migrations.includes(`'${perm}'`), `${d.id}: ${perm} no está en las migraciones`);
      }
    }
  });
});

describe("filtro por rol y permisos", () => {
  it("el jugador no ve destinos de staff", () => {
    const ids = visibleDestinations({ roles: ["jugador"], staff: false, evaluations: false, permissions: [] }).map((d) => d.id);
    assert.ok(ids.includes("mi-plan") && ids.includes("registrar-lesion"));
    for (const staffOnly of ["metricas", "staff", "registros", "configuracion", "planes", "asistencia", "evaluaciones"]) {
      assert.ok(!ids.includes(staffOnly), staffOnly);
    }
  });

  it("el staff usa sus permisos reales, no la plantilla", () => {
    const sin = visibleDestinations({ roles: ["kinesiologo"], staff: true, evaluations: true, permissions: [] }).map((d) => d.id);
    assert.ok(!sin.includes("zonas"));
    const con = visibleDestinations({ roles: ["kinesiologo"], staff: true, evaluations: true, permissions: ["lesiones_ver"] }).map((d) => d.id);
    assert.ok(con.includes("zonas") && !con.includes("mi-plan"));
  });
});

describe("búsqueda", () => {
  const ctx = { roles: ["head_coach"], staff: true, evaluations: true, permissions: [...PERMISSIONS] };
  it("sin tildes ni mayúsculas y por sinónimos", () => {
    assert.equal(searchDestinations("ZONAS", ctx)[0]?.id, "zonas");
    assert.equal(searchDestinations("donde", ctx)[0]?.id, "zonas");
    assert.equal(searchDestinations("paron", ctx)[0]?.id, "paron");
    assert.equal(searchDestinations("nómina", ctx)[0]?.id, "nominas");
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
    assert.deepEqual(highlightParts("Ana", ""), [{ text: "Ana", hit: false }]);
  });
});
