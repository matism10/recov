import Link from "next/link";
import {
  LEGAL_CONTACT,
  LEGAL_DRAFT_NOTE,
  LEGAL_UPDATED,
  PRIVACY,
  TERMS,
  type LegalDoc,
} from "@/lib/legal/content";

// Página pública de un texto legal: columna de lectura, sin la navegación de la app.
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "privacidad" ? TERMS : PRIVACY;
  return (
    <main className="flex-1 bg-white px-4 py-10">
      <article className="mx-auto w-full max-w-2xl">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-brand-text underline">
          Recov
        </Link>
        <p className="mt-2 text-xs text-muted">{LEGAL_DRAFT_NOTE}</p>
        <h1 className="mt-2 text-3xl font-extrabold text-ink">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted">{LEGAL_UPDATED}</p>

        <div className="mt-8 space-y-7">
          {doc.sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold text-ink">
                {i + 1}. {s.title}
              </h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-2 leading-relaxed text-ink">
                  {p}
                </p>
              ))}
              {s.items && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-ink">
                  {s.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <footer className="mt-10 flex flex-wrap items-center gap-x-6 border-t border-line pt-4 text-sm">
          <Link href={`/${other.slug}`} className="inline-flex min-h-11 items-center font-medium text-brand-text underline">
            {other.title}
          </Link>
          <a href={`mailto:${LEGAL_CONTACT}`} className="inline-flex min-h-11 items-center text-muted underline">
            {LEGAL_CONTACT}
          </a>
        </footer>
      </article>
    </main>
  );
}
