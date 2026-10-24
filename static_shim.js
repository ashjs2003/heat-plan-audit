// Static demo: serves the app's /api calls from precomputed files in data/ (build_static.py). Live re-optimization
// with changed strategies needs the full app, so those calls show the default mix and say so.
(() => {
  const real = window.fetch.bind(window);
  const SRC = {};
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
  let noteEl = null;
  const note = (show) => {
    if (!noteEl) {
      noteEl = document.createElement("div");
      noteEl.textContent = "Static demo: changing strategies needs the live app. Showing the default best mix.";
      noteEl.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;max-width:calc(100% - 32px);" +
        "padding:8px 14px;border-radius:8px;background:#222;color:#fff;font:13px system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)";
      document.body.appendChild(noteEl);
    }
    noteEl.hidden = !show;
  };
  window.fetch = async (u, opt) => {
    const url = new URL(typeof u === "string" ? u : u.url, location.href);
    const i = url.pathname.indexOf("/api/");
    if (i < 0) return real(u, opt);
    const p = url.pathname.slice(i);
    let m;
    if (p === "/api/jurisdictions") return real("data/jurisdictions.json");
    if (p === "/api/map") return real("data/map.json");
    if ((m = p.match(/^\/api\/j\/(\w+)\/studio$/))) {
      const v = url.searchParams.get("view");
      return real(`data/${m[1]}/studio${v ? "_" + v : ""}.json`);
    }
    if ((m = p.match(/^\/api\/j\/(\w+)\/optimize$/))) {
      const b = JSON.parse((opt && opt.body) || "{}");
      note(Object.keys(b.strategies || {}).length > 0);
      return real(`data/${m[1]}/optimize_${b.view || "null"}_${b.scope || "plan"}.json`);
    }
    if ((m = p.match(/^\/api\/source\/(\w+)\/(.+)$/))) {
      const j = m[1], id = decodeURIComponent(m[2]);
      SRC[j] = SRC[j] || real(`data/${j}/sources.json`).then((r) => r.json());
      const S = await SRC[j];
      return S[id] ? json(S[id]) : json({ detail: "not in the static demo" }, 404);
    }
    return json({ detail: "not in the static demo" }, 404);
  };
})();
