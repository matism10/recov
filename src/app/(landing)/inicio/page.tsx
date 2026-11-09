import Image from "next/image";
import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_IMAGE_FILES, LANDING_IMAGES, PHONE_SIZE } from "@/lib/landing/config";
import logo from "@/app/recov-logo.png";
import { AccessForm } from "./access-form";
import { BrowserFrame, Shot } from "./frame";
import { Screens } from "./screens";
import { Sports } from "./sports";

// Resuelve cada captura de public/landing/ (webp o png); sin archivo, null (bloque gris).
function resolveImages() {
  const out: Record<string, string | null> = {};
  for (const f of ALL_IMAGE_FILES) {
    const ext = ["webp", "png"].find((e) => existsSync(path.join(process.cwd(), "public", "landing", `${f}.${e}`)));
    out[f] = ext ? `/landing/${f}.${ext}` : null;
  }
  return out;
}

const cta =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-[#0B1B2B] px-7 font-bold text-white transition hover:bg-[#12304A]";
const wrap = "mx-auto w-full max-w-[1200px] px-6";
const h2 = "font-[family-name:var(--l-title)] text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl";

export default function LandingPage() {
  const images = resolveImages();
  const hero = LANDING_IMAGES.hero;
  return (
    <main>
      <section id="acceso" className="overflow-x-clip bg-[#38BDF8] pb-0 lg:pb-20">
        <div className={wrap}>
          <header className="flex min-h-16 items-center justify-between">
            <span className="flex items-center gap-2">
              <Image src={logo} alt="" width={36} height={36} className="size-9 rounded-lg" />
              <span className="font-[family-name:var(--l-title)] text-2xl font-extrabold tracking-tight">Recov</span>
            </span>
            <nav aria-label="Secciones" className="flex items-center gap-2">
              {[["Funciones", "#funciones"], ["Deportes", "#deportes"]].map(([t, h]) => (
                <a key={h} href={h} className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#0B1B2B] bg-transparent px-4 text-sm font-semibold text-[#0B1B2B]">{t}</a>
              ))}
            </nav>
          </header>
          <div className="mt-6 grid gap-y-8 lg:mt-12 lg:grid-cols-[42%_1fr] lg:gap-x-12 lg:gap-y-6">
            <div className="space-y-6 lg:self-end">
              <h1 className="font-[family-name:var(--l-title)] text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Ten claro quién puede jugar el sábado. <span className="text-[#05445E]">Sin un solo WhatsApp.</span>
              </h1>
              <p className="max-w-[34rem] text-lg text-[#0B1B2B]">
                Recov controla lesiones, fecha de vuelta y disponibilidad de tu club amateur en una sola pantalla.
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-[300px] md:max-w-none lg:row-span-2 lg:w-[calc(100%+6rem)] lg:max-w-none lg:self-center">
              <div className="mx-auto h-[300px] w-[220px] overflow-hidden rounded-t-[36px] border-[8px] border-b-0 border-[#0B1B2B] bg-white md:hidden">
                <Shot src={images["staff-resumen"]} name="staff-resumen" width={PHONE_SIZE.width} height={PHONE_SIZE.height} sizes="220px" priority />
              </div>
              <BrowserFrame className="hidden md:block">
                <Shot src={images[hero.name]} name={hero.name} width={hero.width} height={hero.height} sizes="(min-width: 1024px) 58vw, 100vw" priority />
              </BrowserFrame>
              <div className="absolute top-10 left-0 rounded-xl bg-white px-2 py-1.5 text-[11px] shadow-lg md:-top-3 md:left-2 md:px-3 md:py-2 md:text-sm lg:-left-4">
                <p className="font-bold">Tomás R. vuelve el 18 nov</p>
                <p className="text-[#3F5266]">Rodilla · Reintegro</p>
              </div>
              <div className="absolute right-0 bottom-10 rounded-xl bg-white px-2 py-1.5 text-[11px] shadow-lg md:-bottom-4 md:right-6 md:px-3 md:py-2 md:text-sm">
                <p className="font-bold">51 disponibles</p>
                <p className="text-[#3F5266]">Sábado 16:00</p>
              </div>
            </div>
            <div className="-mx-6 rounded-t-[28px] bg-white px-6 pt-6 pb-10 lg:mx-0 lg:self-start lg:rounded-none lg:bg-transparent lg:p-0">
              <AccessForm />
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="scroll-mt-4 py-16 lg:py-24">
        <div className={wrap}>
          <h2 className={`${h2} max-w-3xl`}>Todo tu club, en el celular.</h2>
          <p className="mt-3 max-w-2xl text-lg text-[#3F5266]">
            Tus jugadores y tu staff usan la misma app. Tú ves el estado real del plantel, sin planillas.
          </p>
          <div className="mt-8">
            <Screens images={images} />
          </div>
          <a href="#acceso" className={`${cta} mt-6`}>Pedir acceso anticipado</a>
        </div>
      </section>

      <section id="deportes" className="scroll-mt-4 bg-[#0B1B2B] py-16 text-white lg:py-24">
        <div className={wrap}>
          <div className="flex items-end gap-4">
            <span className="font-[family-name:var(--l-title)] text-[120px] leading-[0.8] font-extrabold tracking-tighter text-[#38BDF8] sm:text-[180px]">7</span>
            <h2 className={h2}>deportes. Un solo Recov.</h2>
          </div>
          <p className="mt-4 mb-8 max-w-2xl text-lg text-[#CBD9E6]">
            La misma app para todo el club, adaptada a cada deporte. Por ejemplo, rugby con planteles de 15 y Sevens.
          </p>
          <Sports />
          <a href="#acceso" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#38BDF8] px-7 font-bold text-[#04263D] transition hover:bg-[#7dd3fc]">
            Pedir acceso anticipado
          </a>
        </div>
      </section>

      <section className="bg-[#F5F9FC] py-16 lg:py-20">
        <div className={`${wrap} grid gap-6 md:grid-cols-3`}>
          {[
            ["¿Mis jugadores lo van a usar?", "Se registran solos desde el celular. Tú solo apruebas a quién entra al plantel."],
            ["¿Quién ve los datos médicos?", "Solo el staff autorizado de tu club. Cada club ve únicamente lo suyo."],
            ["¿Me cobran o me atan a algo?", "No. Sin pago automático ni contrato: primero conversamos y ves si te sirve."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-2xl border border-[#CBD9E6] bg-white p-6">
              <h3 className="font-[family-name:var(--l-title)] text-xl font-bold tracking-tight">{q}</h3>
              <p className="mt-2 text-[#3F5266]">{a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="bg-[#0B1B2B] py-8 text-sm text-[#CBD9E6]">
        <div className={`${wrap} flex flex-wrap items-center gap-x-6 gap-y-2`}>
          <span>© 2026 Recov</span>
          <Link href="/terminos" className="inline-flex min-h-11 items-center underline">Términos y Condiciones</Link>
          <Link href="/privacidad" className="inline-flex min-h-11 items-center underline">Política de Privacidad</Link>
          <a href="mailto:contacto@recov.cl" className="inline-flex min-h-11 items-center underline">contacto@recov.cl</a>
        </div>
      </footer>
    </main>
  );
}
