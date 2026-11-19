// Al llegar a un #ancla: abre los <details> que la contienen y la deja a la vista. La
// sección puede tardar en pintarse (streaming), así que reintenta hasta 5 s.
export function revealAnchor(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return;
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) {
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        if (node instanceof HTMLDetailsElement && !node.open) node.open = true;
      }
      // Siempre se deja a la vista: el Resumen llega por partes (streaming) y el
      // salto del navegador al #ancla ocurre antes de que la sección exista.
      el.scrollIntoView({ block: "start" });
      return;
    }
    if (++tries < 50) window.setTimeout(attempt, 100);
  };
  attempt();
}
