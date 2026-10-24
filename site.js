// Public-site layer over app.js (loaded before it; build_static.py renames a few app.js functions to _name and these wrap them).
//  - "Coming soon" jurisdictions (site_status.py: the heat curve shows no measurable effect): plan facts only, no lives numbers.
//  - Cold is provisional: a ⚠ tag on every cold value, the full note on click.
//  - Short warnings in the footer; ⓘ "How it works" link on every page.
const SITE = { soon: new Set(), facts: {} };
const COLD_NOTE = "⚠ Cold estimates are provisional. The temperature–mortality curves we use look back only 5 days, but cold's effect builds over 2–3 weeks. Our cold totals sit within published ranges, but the method still needs a longer-lag curve. Heat estimates don't depend on this.";
const SOON_BANNER = "Lives-saved analysis coming soon: the published EPA temperature–mortality curve for this region shows no measurable heat effect, so we can't yet estimate lives saved here.";

function coldTag(h) {
  return h === "cold" || h === "both" ? `<span class="coldw" role="button" tabindex="0" title="${COLD_NOTE.replace(/"/g, "&quot;")}">⚠ cold provisional</span>` : "";
}
function coldBox() { return `<div class="sitenote cold">${COLD_NOTE}</div>`; }
function showNote(html, key) {
  let box = document.getElementById("site-notes");
  if (!box) { box = document.createElement("div"); box.id = "site-notes"; document.body.appendChild(box); }
  if (key && box.querySelector(`[data-k="${key}"]`)) return;
  const n = document.createElement("div"); n.className = "sitenote float"; if (key) n.dataset.k = key;
  n.innerHTML = `<button class="x" aria-label="Dismiss">×</button>${html}`;
  n.querySelector(".x").onclick = () => n.remove();
  box.appendChild(n);
}
document.addEventListener("click", (e) => {
  if (e.target.closest(".coldw")) { e.preventDefault(); e.stopPropagation(); showNote(COLD_NOTE, "cold"); }
}, true);
function siteScopeNote() {
  const box = document.getElementById("site-notes"), n = box && box.querySelector('[data-k="standing"]');
  if (typeof S !== "undefined" && S.scope === "standing") showNote(`<details><summary><b>+ Long-term</b> is mostly cold deaths: ⚠ cold estimates are provisional</summary>${COLD_NOTE}</details>`, "standing");
  else if (n) n.remove();
}

// ---------- wrappers over app.js
function targetsLine(st) {
  const a = st.seg_assumed === "all" ? '<p class="tg assumed">⚠ Target group assumed (plan names none)</p>'
    : st.seg_assumed === "some" ? '<p class="tg assumed">⚠ Target group assumed for some commitments (plan names none)</p>' : "";
  return _targetsLine(st) + a;
}
function mapTip(r) {
  if (r.soon) return `<div class="th"><b>${esc(r.name)}</b><span class="tag">coming soon</span></div>
    <div class="tm">Lives-saved analysis coming soon: insufficient curve data.</div><div class="cta">Click to see its plans →</div>`;
  return _mapTip(r) + `<div class="tm">${coldTag("cold")} temperature deaths include cold</div>`;
}
function renderFoot() {
  _renderFoot();
  $("foot").insertAdjacentHTML("beforeend", `<span title="If a county's heat deaths are off by a constant factor, every dot, the line and the ★ move together, so the plan's share of the best mix and which timing wins still hold.">Absolute numbers are illustrative; comparisons hold up</span>`);
}
function soonTraces() {
  const L = MS.rows.filter((r) => r.soon && r.level === "county");
  return L.length ? [{ type: "choroplethmapbox", geojson: MS.geo, locations: L.map((r) => r.jurisdiction_id), z: L.map(() => 0),
    colorscale: [[0, "rgba(140,140,140,0.55)"], [1, "rgba(140,140,140,0.55)"]], showscale: false,
    marker: { line: { width: 0.4, color: css("--border") } }, hoverinfo: "none", customdata: L.map((r) => r.jurisdiction_id) }] : [];
}
async function showStudio(parts) {
  const j = parts[0];
  await SITE.ready;
  if (!SITE.soon.has(j)) { $("soon").hidden = true; return _showStudio(parts); }
  await jurisdictionsList();
  document.body.dataset.page = "soon"; $("mapview").hidden = true; $("studio").hidden = true; $("foot").hidden = true; $("analyse").hidden = true;
  $("to-map").hidden = false; $("view").innerHTML = ""; $("jur").value = j;
  S.j = j; S.view = "evidence";
  SITE.facts[j] = SITE.facts[j] || (await (await fetch(`data/${j}/facts.json`)).json());
  renderSoon(SITE.facts[j]); setHow(j);
  const hs = parts.find((p) => p.startsWith("src="));
  if (hs) openDrawer([decodeURIComponent(hs.slice(4))]);
}
function renderSoon(F) {
  const own = F.docs.filter((d) => d.layer === "own").length;
  $("doc").textContent = `${F.name} · ${own} plan${own === 1 ? "" : "s"} of its own${F.docs.length - own ? ` + ${F.docs.length - own} inherited` : ""}`;
  const byGroup = {}; F.strategies.forEach((s) => (byGroup[s.group] ??= []).push(s));
  const LAYER = { own: "Its own", county: "From its county", state: "From its state", city: "From its city" };
  $("soon").innerHTML = `<div class="soonwrap">
    <div class="sitenote banner"><b>${esc(F.banner || SOON_BANNER)}</b> ${chip(F.banner_cite, "why")}</div>
    <p class="muted">Shown here: the plan data that doesn't depend on the curve. No chart, best mix or lives-saved numbers until the curve is fixed. <a href="how.html#${F.jurisdiction_id}">How it works ⓘ</a></p>
    <h2>Plans in force</h2>
    <ul class="soonlist">${F.docs.map((d) => `<li><b>${esc(d.title)}</b> <span class="muted">(${esc(d.year ?? "")}, ${esc(LAYER[d.layer] || d.layer)}${d.from_name && d.layer !== "own" ? `: ${esc(d.from_name)}` : ""})</span>
      ${d.pdf ? ` · <a href="${esc(d.pdf)}" target="_blank" rel="noopener">PDF ↗</a>` : ""}</li>`).join("")}</ul>
    <h2>Strategies its plans commit to</h2>
    ${Object.entries(byGroup).map(([g, L]) => `<h3>${esc(g)}</h3>${L.map((s) => `<div class="soonrow">
      <div><b>${esc(s.label)}</b> <span class="badge">${esc(s.grade_label)}</span> ${s.firm ? '<span class="badge">firm</span>' : ""} <span class="hz">${HZ[s.hazard] || ""}</span> ${coldTag(s.hazard)}</div>
      <div class="muted">Targets ${esc(s.target)}${s.seg_assumed ? " · ⚠ target group assumed (plan names none)" : ""} · lever: ${esc(s.lever_owner || "–")}</div>
      ${s.plan_assigns.map((a) => `<div class="muted">Plan assigns: ${esc(a.label)} (${a.n}) ${chip(a.cite, "quote")}</div>`).join("")}
      <div>${chip(s.cite)}</div></div>`).join("")}`).join("")}
    <h2>Activation triggers</h2>
    ${F.triggers.length ? `<ul class="soonlist">${F.triggers.map((t) => `<li><b>${esc(t.label)}</b> <span class="muted">(${esc(t.hazard)}; ${esc(t.doc_id)})</span> · conversion: ${esc(t.conversion)} ${chip(t.cite)}</li>`).join("")}</ul>`
      : '<p class="muted">No activation triggers are coded in its plans.</p>'}
    <h2>Questionnaire answers (its own plans)</h2>
    ${F.checklist.map((c) => `<details class="soonq"><summary>${esc(c.title)}</summary><table>${c.items.map((i) => `<tr><td>${esc(i.question)}</td>
      <td><b>${esc(Array.isArray(i.value) ? i.value.join(", ") : i.value ?? "not stated")}</b> ${chip(i.cite, "")}</td></tr>`).join("")}</table></details>`).join("") || '<p class="muted">It has no plans of its own.</p>'}
  </div>`;
  $("soon").hidden = false;
}
function setHow(j) { const a = document.getElementById("how"); if (a) a.href = `how.html#${j || (typeof S !== "undefined" && S.j) || ""}`; }
window.addEventListener("hashchange", () => { const j = location.hash.slice(1).split("/")[0]; setHow(j && j !== "map" ? j : ""); if (j === "map" || !j) $("soon").hidden = true; });
document.addEventListener("DOMContentLoaded", () => { const j = location.hash.slice(1).split("/")[0]; setHow(j && j !== "map" ? j : ""); });
SITE.ready = fetch("data/site.json").then((r) => r.json()).then((d) => { d.soon.forEach((j) => SITE.soon.add(j)); });
