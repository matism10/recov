// Permisos del staff (20261106120000). La base decide con private.has_perm; aquí solo
// se decide qué se muestra. Los permisos efectivos de la sesión los trae getProfile
// (my_permissions) y quedan pegados al arreglo de roles del plantel activo, así los
// helpers de roles.ts, gym-roles.ts, evaluations.ts y nav-slots.ts siguen recibiendo
// solo `roles`. Si el arreglo no trae permisos (por ejemplo, en un componente de cliente),
// se usa la plantilla del rol: lo mismo que la base sin ajustes.
import type { UserRole } from "@/lib/roles";

export const PERMISSIONS = [
  "lesiones_ver",
  "lesiones_revisar",
  "documentos_ver",
  "lesionado_marcar",
  "disponibilidad_cambiar",
  "eventos_editar",
  "eventos_cancelar",
  "lista_pasar",
  "nomina_armar",
  "participacion_cargar",
  "evaluaciones_cargar",
  "tests_catalogo",
  "gimnasio_planes",
  "carga_ver",
  "check_dias",
  "registros_aprobar",
  "posicion_cambiar",
  // No delegables (solo por rol: head coach y manager).
  "staff_gestionar",
  "sevens_activar",
  "sevens_grupo",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const NON_DELEGABLE: readonly Permission[] = ["staff_gestionar", "sevens_activar", "sevens_grupo"];

// Grupos y textos de /staff (en el orden en que se muestran).
export const PERMISSION_GROUPS: { title: string; items: { key: Permission; label: string }[] }[] = [
  {
    title: "Lesiones",
    items: [
      { key: "lesiones_ver", label: "Ver lesiones y fases" },
      { key: "lesiones_revisar", label: "Revisar, confirmar y dar de alta" },
      { key: "documentos_ver", label: "Ver documentos médicos" },
      { key: "lesionado_marcar", label: "Marcar lesionado" },
      { key: "disponibilidad_cambiar", label: "Cambiar disponibilidad" },
    ],
  },
  {
    title: "Calendario",
    items: [
      { key: "eventos_editar", label: "Crear y editar eventos" },
      { key: "eventos_cancelar", label: "Cancelar eventos" },
      { key: "lista_pasar", label: "Pasar lista" },
    ],
  },
  {
    title: "Nóminas",
    items: [
      { key: "nomina_armar", label: "Armar nómina" },
      { key: "participacion_cargar", label: "Cargar participación" },
    ],
  },
  {
    title: "Evaluaciones y gimnasio",
    items: [
      { key: "evaluaciones_cargar", label: "Cargar evaluaciones" },
      { key: "tests_catalogo", label: "Administrar catálogo de tests" },
      { key: "gimnasio_planes", label: "Crear y publicar planes de gimnasio" },
    ],
  },
  {
    title: "Carga y bienestar",
    items: [
      { key: "carga_ver", label: "Ver reportes sRPE y bienestar" },
      { key: "check_dias", label: "Elegir días del check" },
    ],
  },
  { title: "Dirección", items: [{ key: "registros_aprobar", label: "Aprobar registros" }] },
  { title: "Jugadores", items: [{ key: "posicion_cambiar", label: "Cambiar posición de jugadores" }] },
];

// Plantilla por rol: igual que private.role_permissions. El head coach tiene todo.
const ALL_STAFF: Permission[] = ["lesiones_ver", "lista_pasar", "carga_ver"];
const KINE: Permission[] = ["lesiones_revisar", "documentos_ver", "lesionado_marcar", "disponibilidad_cambiar"];
const NOMINA: Permission[] = ["nomina_armar", "participacion_cargar"];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  head_coach: PERMISSIONS,
  manager: [
    ...ALL_STAFF, "eventos_editar", "eventos_cancelar", ...NOMINA, "check_dias", "registros_aprobar",
    "staff_gestionar", "sevens_activar", "sevens_grupo",
  ],
  entrenador: [...ALL_STAFF, "eventos_editar", "eventos_cancelar"],
  kinesiologo: [...ALL_STAFF, ...KINE, "evaluaciones_cargar", "tests_catalogo"],
  nutricionista: ALL_STAFF,
  preparador_fisico: [...ALL_STAFF, "evaluaciones_cargar", "tests_catalogo", "gimnasio_planes", "check_dias"],
  jugador: [],
};

// Permisos que da cada delegación (clubs.kine_delegate_id, clubs.nomina_delegate_id).
export const DELEGATION_PERMISSIONS = { kine: KINE, nomina: NOMINA } as const;

// Permisos efectivos pegados al arreglo de roles del plantel activo (ver getProfile).
const attached = new WeakMap<readonly string[], ReadonlySet<string>>();

export function withPermissions<T extends readonly string[]>(roles: T, perms: readonly string[]): T {
  attached.set(roles, new Set(perms));
  return roles;
}

// Permisos por rol, sin ajustes (lo que "Restablecer al rol" deja).
export function rolePermissions(roles: readonly string[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r as UserRole] ?? []) set.add(p);
  return set;
}

// ¿Los roles (con sus permisos pegados, si vienen) tienen este permiso?
export function can(roles: readonly string[], perm: Permission): boolean {
  const perms = attached.get(roles);
  return perms ? perms.has(perm) : rolePermissions(roles).has(perm);
}

// true si el arreglo trae los permisos efectivos de la base (incluye delegaciones y ajustes).
export function hasEffectivePermissions(roles: readonly string[]): boolean {
  return attached.has(roles);
}
