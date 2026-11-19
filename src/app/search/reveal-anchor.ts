// Al llegar a un #ancla: abre los <details> que la contienen y la deja a la vista. La
// sección puede tardar en pintarse (streaming), así que reintenta unos instantes.
export function revealAnchor(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return;
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) {
      let opened = false;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        if (node instanceof HTMLDetailsElement && !node.open) {
          node.open = true;
          opened = true;
        }
      }
      if (opened) el.scrollIntoView({ block: "start" });
      return;
    }
    if (++tries < 20) window.setTimeout(attempt, 100);
  };
  attempt();
}
