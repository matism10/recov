import Image from "next/image";
import Link from "next/link";
import logo from "@/app/recov-logo.png";
import { FAQS, PLAYER_FEATURES, STAFF_FEATURES } from "@/lib/landing/config";
import { AccessForm } from "./access-form";
import { Features } from "./features";
import { SportsDemo } from "./sports-demo";

const NAV = [
  ["Cómo funciona", "#como-funciona"],
  ["Funciones", "#funciones"],
  ["Deportes", "#deportes"],
  ["Preguntas", "#preguntas"],
] as const;

const STEPS = [
  {
    title: "Comparte el link del plantel.",
    text: "El head coach lo manda al grupo. Cada jugador se registra desde su celular y tú apruebas quién entra.",
    tag: "Sin planillas. Sin WhatsApp.",
  },
  {
    title: "Registra estímulos, lesiones y cargas.",
    text: "Staff o jugador marcan sus lesiones y registran sus estímulos para controlar la carga.",
    tag: "Datos médicos solo para el staff.",
  },
  {
    title: "Decide quién juega.",
    text: "Disponibilidad, fecha de vuelta y carga de cada jugador antes de armar la nómina.",
    tag: "Todo en una sola pantalla.",
    blue: true,
  },
];

const Arrow = ({ down = false }: { down?: boolean }) => <span aria-hidden="true">{down ? "↓" : "↗"}</span>;

function Brand({ size }: { size: number }) {
  return (
    <>
      <Image src={logo} alt="" width={size} height={size} style={{ width: size, height: size }} />
      <span>Recov</span>
    </>
  );
}

export default function LandingPage() {
  return (
    <>
      <a href="#main" className="lp-skip">Saltar al contenido</a>

      <header className="lp-header">
        <div className="lp-wrap lp-header-in">
          <a href="#main" className="lp-brand" aria-label="Recov, ir al inicio">
            <Brand size={34} />
          </a>
          <nav aria-label="Secciones" className="lp-nav">
            {NAV.map(([t, h]) => <a key={h} href={h}>{t}</a>)}
          </nav>
          <a href="#acceso" className="lp-btn lp-btn-navy">Pide acceso <Arrow /></a>
        </div>
      </header>

      <main id="main">
        {/* 1. Hero */}
        <section aria-labelledby="hero-title" className="lp-hero">
          <div className="lp-hero-box">
            <Image src="/landing/hero.webp" alt="" fill priority sizes="100vw" className="lp-hero-photo" />
            <div className="lp-hero-shade" aria-hidden="true" />
            <div className="lp-hero-grid">
              <div className="lp-hero-copy">
                <p className="lp-kicker">Menos lesiones sorpresa. Más jugadores el sábado.</p>
                <h1 id="hero-title" className="lp-display lp-h1">Tu plantel al día. Sin un solo WhatsApp.</h1>
                <p className="lp-lead">Lesiones, fecha de vuelta, cargas y disponibilidad de tu club amateur, en una sola pantalla.</p>
                <div className="lp-hero-ctas">
                  <a href="#acceso" className="lp-btn lp-btn-lg lp-btn-celeste">Pide acceso para tu club <Arrow /></a>
                  <a href="#como-funciona" className="lp-btn lp-btn-lg lp-btn-ghost">Cómo funciona <Arrow down /></a>
                </div>
              </div>
              <div className="lp-ipad-wrap">
                <div className="lp-ipad">
                  <div className="lp-ipad-screen">
                    <Image
                      src="/landing/hero-ipad-staff-resumen.webp"
                      alt="Resumen del staff en un iPad: disponibles, lesionados, en reintegro y el próximo partido del plantel demo."
                      fill
                      priority
                      sizes="(min-width: 1100px) 670px, 572px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Cómo funciona */}
        <section id="como-funciona" aria-labelledby="pasos-title" className="lp-steps-sec">
          <div className="lp-wrap lp-two">
            <div className="lp-steps-intro">
              <p className="lp-kicker">El staff decide. El plantel se mantiene al día.</p>
              <h2 id="pasos-title" className="lp-display lp-h2">Comparte.<br />Registra.<br />Decide.</h2>
              <p className="lp-lead">Staff y jugadores usan la misma app. Se instala desde el navegador, sin App Store.</p>
              <a href="#acceso" className="lp-link">Pide acceso para tu club <Arrow /></a>
            </div>
            <ol className="lp-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="lp-step">
                  <span className="lp-display lp-step-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                    <p className={`lp-kicker lp-tag${s.blue ? " lp-tag-azul" : ""}`}>{s.tag}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3. Funciones */}
        <section id="funciones" aria-labelledby="funciones-title" className="lp-features">
          <div className="lp-wrap">
            <Features staff={STAFF_FEATURES} players={PLAYER_FEATURES} />
          </div>
        </section>

        {/* 4. Deportes */}
        <section id="deportes" aria-labelledby="deportes-title" className="lp-sports">
          <div className="lp-wrap">
            <div className="lp-sports-head">
              <div>
                <p className="lp-kicker lp-label">✳ Deportes</p>
                <h2 id="deportes-title" className="lp-display lp-h2">7 deportes.<br />Un solo Recov.</h2>
              </div>
              <p className="lp-lead">
                La misma app se adapta a tu deporte: puestos, nóminas y minutos de partido. En rugby, plantel de 15 y Sevens en el mismo lugar.
              </p>
            </div>
            <SportsDemo />
          </div>
        </section>

        {/* 5. Pide acceso */}
        <section id="acceso" aria-labelledby="acceso-title" className="lp-access">
          <div className="lp-access-box">
            <div className="lp-access-grid">
              <div>
                <p className="lp-kicker">Estás a un link de tu mejor pretemporada</p>
                <h2 id="acceso-title" className="lp-display lp-h2">Parte 2027 con tu plantel al día.</h2>
                <p className="lp-badge">2 meses gratis para los primeros 10 clubes</p>
              </div>
              <AccessForm />
            </div>
          </div>
        </section>

        {/* 6. FAQs */}
        <section id="preguntas" aria-labelledby="faq-title" className="lp-faq">
          <div className="lp-wrap lp-faq-in">
            <p className="lp-kicker lp-label">✳ Antes de partir</p>
            <h2 id="faq-title" className="lp-display lp-h2">FAQs.</h2>
            <div className="lp-faq-list">
              {FAQS.map(([q, a], i) => (
                <details key={q} open={i === 0}>
                  <summary>{q}<span className="lp-plus" aria-hidden="true">+</span></summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-top">
            <div>
              <span className="lp-brand"><Brand size={44} /></span>
              <p className="lp-display">Tu plantel al día.<br />Controla cada lesión.</p>
            </div>
            <div className="lp-footer-contact">
              <a href="mailto:contacto@recov.cl" className="lp-footer-mail">contacto@recov.cl</a>
              <a href="https://www.instagram.com/recovapp/" target="_blank" rel="noopener noreferrer" className="lp-footer-mail">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4.2" />
                  <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
                </svg>
                <span><span className="lp-sr">Instagram </span>@recovapp</span>
              </a>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© 2026 Recov</span>
            <nav aria-label="Legal">
              <Link href="/terminos">Términos y Condiciones</Link>
              <Link href="/privacidad">Política de Privacidad</Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
