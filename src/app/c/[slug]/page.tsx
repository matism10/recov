import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Clock, LogIn, UserPlus } from "lucide-react";
import { getProfile, getSupabase } from "@/lib/session";
import { clubLogoUrl } from "@/lib/club-logo";
import { ClubLogo } from "@/app/club-logo";
import { InstallGuide } from "@/app/install-guide";
import { signIn } from "@/app/login/actions";
import {
  ErrorMessage,
  buttonPrimary,
  buttonSecondary,
  inputClass,
  labelClass,
  linkClass,
  textButton,
} from "@/app/ui";
import { RegisterForm } from "./register-form";
import { JoinForm } from "./join-form";
import { accountName } from "./account-name";
import { joinWithAnotherEmail } from "./actions";
import { PREVIOUS_CLUB_COOKIE } from "./previous-club";

type Card = { name: string; sport: string; category: string | null };

// Link de un plantel. Sin sesión: pestañas Registro | Iniciar sesión. Con sesión:
// si ya es miembro confirmado, activa el plantel y entra; si está pendiente, ve su
// solicitud; si no es miembro, el formulario "Únete a este plantel".
export default async function ClubLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tab = query.tab === "login" ? "login" : "registro";
  const newAccount = query.cuenta === "nueva";
  const loginError = query.error === "1";
  const supabase = await getSupabase();

  // En paralelo: la ficha pública del plantel (nombre, deporte y categoría, sin
  // sesión), la ruta de su logo (bucket público) y la sesión.
  const [{ data: card }, { data: logoPath }, { data: auth }] = await Promise.all([
    supabase.rpc("club_public_card", { p_slug: slug }).maybeSingle<Card>(),
    supabase.rpc("club_logo_path", { p_slug: slug }),
    supabase.auth.getClaims(),
  ]);

  if (!card) {
    return (
      <main className="flex flex-1 items-center justify-center bg-white px-4">
        <p className="rounded-xl border border-line bg-mist p-8 text-center text-ink">
          Este link no es válido. Pide a la dirección del plantel que te lo envíe de nuevo.
        </p>
      </main>
    );
  }

  const logoUrl = clubLogoUrl(supabase, logoPath as string | null);
  const userId = auth?.claims?.sub;
  const positionsPromise = supabase
    .from("positions")
    .select("name")
    .eq("sport", card.sport)
    .eq("format", "15")
    .order("sort")
    .then(({ data }) => (data ?? []).map((p) => p.name as string));

  // Con sesión: la membresía en este plantel decide qué se ve.
  if (userId) {
    const [profile, { data: club }] = await Promise.all([
      getProfile(userId),
      // RLS: el plantel solo se lee si la cuenta es miembro (con cualquier estado).
      supabase.from("clubs").select("id").eq("slug", slug.toLowerCase()).maybeSingle<{ id: string }>(),
    ]);
    const membership = club ? profile?.memberships.find((m) => m.club_id === club.id) : undefined;
    const otherConfirmed = profile?.memberships.find(
      (m) => m.status === "confirmado" && m.club_id !== club?.id,
    );

    if (membership?.status === "confirmado") {
      redirect(`/activar-plantel?club=${membership.club_id}`);
    }
    if (membership?.status === "pendiente") {
      // Sin otro plantel donde entrar: la pantalla de pendiente de siempre.
      if (!otherConfirmed) redirect("/pendiente");
      return (
        <Shell card={card} logoUrl={logoUrl}>
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              <Clock aria-hidden="true" className="size-5 text-brand-strong" />
              Solicitud enviada
            </h2>
            <p className="text-sm text-ink">
              La dirección de {card.name} la revisará. Te avisaremos cuando te confirmen.
            </p>
            <p className="text-sm text-muted">
              Mientras tanto, sigues con tu acceso a {otherConfirmed.club?.name}.
            </p>
            <Link
              href={`/activar-plantel?club=${otherConfirmed.club_id}`}
              className={`w-full ${buttonPrimary}`}
            >
              Ir a {otherConfirmed.club?.name}
            </Link>
          </div>
        </Shell>
      );
    }
    if (membership) {
      // Rechazado: no puede volver a pedir con esta cuenta (register_member lo impide).
      return (
        <Shell card={card} logoUrl={logoUrl}>
          <p className="text-sm text-ink">
            La dirección de {card.name} no aprobó tu solicitud. Si crees que es un error, habla
            con ellos.
          </p>
          {otherConfirmed && (
            <Link
              href={`/activar-plantel?club=${otherConfirmed.club_id}`}
              className={`mt-4 w-full ${buttonSecondary}`}
            >
              Ir a {otherConfirmed.club?.name}
            </Link>
          )}
        </Shell>
      );
    }

    // No es miembro: se une con su cuenta.
    const [positions, name] = await Promise.all([positionsPromise, accountName(supabase, userId)]);
    const fullName = profile?.full_name?.trim() ?? "";
    const [first = "", ...rest] = fullName.split(/\s+/);
    const greeting = name?.first ?? first;
    // Plantel actual de la cuenta, para el aviso de "Unirme con otro correo".
    const previous = profile?.club?.name ?? "";
    return (
      <Shell card={card} logoUrl={logoUrl}>
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              {greeting ? `Hola, ${greeting}` : "Únete a este plantel"}
            </h2>
            <p className="mt-1 text-sm text-muted">Tu cuenta ya existe: solo elige cómo te unes.</p>
          </div>
          <JoinForm
            slug={slug}
            positions={positions}
            // Sin ficha de jugador (cuenta solo de staff): nombre y apellido para confirmar.
            confirmName={name ? null : { first, last: rest.join(" ") }}
          />
          <form action={joinWithAnotherEmail} className="border-t border-line pt-4 text-sm">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="previous" value={previous} />
            <p className="text-muted">¿Prefieres usar otro correo en este plantel?</p>
            <button type="submit" className={`inline-flex min-h-11 items-center ${linkClass}`}>
              Unirme con otro correo
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  // Sin sesión: Registro | Iniciar sesión.
  const previous = newAccount ? ((await cookies()).get(PREVIOUS_CLUB_COOKIE)?.value ?? "") : "";
  const positions = tab === "registro" ? await positionsPromise : [];
  const base = `/c/${slug}`;
  return (
    <Shell card={card} logoUrl={logoUrl}>
      <nav aria-label="Elige una opción" className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
        <TabLink href={`${base}?tab=registro`} active={tab === "registro"} Icon={UserPlus}>
          Registro
        </TabLink>
        <TabLink href={`${base}?tab=login`} active={tab === "login"} Icon={LogIn}>
          Iniciar sesión
        </TabLink>
      </nav>

      {tab === "registro" ? (
        <div className="mt-5 space-y-4">
          {newAccount && (
            <p role="status" className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink">
              Crearás una cuenta aparte.
              {previous && ` No quedará unida a tu cuenta de ${previous}.`}
            </p>
          )}
          <RegisterForm slug={slug} positions={positions} loginHref={`${base}?tab=login`} />
          <p className="text-center text-sm text-muted">
            {newAccount ? "¿Prefieres usar tu cuenta actual?" : "¿Ya tienes cuenta?"}{" "}
            <Link href={`${base}?tab=login`} className={`inline-flex min-h-11 items-center ${linkClass}`}>
              Inicia sesión
            </Link>
          </p>
        </div>
      ) : (
        <form action={signIn} className="mt-5 space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm text-ink">
            ¿Ya tienes cuenta en otro plantel? Entra con el mismo correo y la misma contraseña.
          </p>
          <label className={labelClass}>
            Correo
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </label>
          <label className={labelClass}>
            Contraseña
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </label>
          {loginError && (
            <ErrorMessage>Correo o contraseña incorrectos. Revísalos e intenta de nuevo.</ErrorMessage>
          )}
          <button type="submit" className={`w-full ${buttonPrimary}`}>
            Entra
          </button>
          <Link href="/recuperar" className={`block text-center ${textButton}`}>
            ¿Olvidaste tu contraseña?
          </Link>
          <p className="text-center text-sm text-muted">
            ¿No tienes cuenta?{" "}
            <Link href={`${base}?tab=registro`} className={`inline-flex min-h-11 items-center ${linkClass}`}>
              Regístrate
            </Link>
          </p>
        </form>
      )}
    </Shell>
  );
}

// Marco del link: logo, nombre y categoría del plantel arriba; el contenido abajo.
function Shell({
  card,
  logoUrl,
  children,
}: {
  card: Card;
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="w-full space-y-5 rounded-xl border border-line bg-mist p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <ClubLogo name={card.name} url={logoUrl} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-sm font-extrabold text-ink">Recov</p>
              <h1 className="text-2xl leading-tight font-semibold text-ink">{card.name}</h1>
              {card.category && <p className="mt-0.5 text-sm text-muted">{card.category}</p>}
            </div>
          </div>
          {children}
        </div>
        <InstallGuide />
      </div>
    </main>
  );
}

function TabLink({
  href,
  active,
  Icon,
  children,
}: {
  href: string;
  active: boolean;
  Icon: typeof LogIn;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      replace
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition ${
        active ? "bg-brand-soft font-semibold ring-1 ring-brand" : "hover:bg-mist"
      }`}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children}
    </Link>
  );
}
