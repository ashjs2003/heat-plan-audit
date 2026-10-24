// "How it works": the eight steps from plan PDF to chart, filled from data/{j}/method.json (build_method.py). No number is typed here.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const f = (x, d = 0) => (x == null || isNaN(x) ? "–" : Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const f1 = (x) => (x == null ? "–" : Math.abs(x) >= 10 ? f(x, 0) : f(x, 1));
const pct = (x, d = 0) => (x == null ? "–" : `${f(100 * x, d)}%`);
const lc = (s) => String(s || "").toLowerCase().replace(/_/g, " ");
let D = null;
const KIND = (id) => (id.startsWith("plan:") || id.startsWith("ev:") || id.startsWith("data:") || id.startsWith("eval:") ? ["cited", "✓"] : id.startsWith("asm:") ? ["assumed", "⚠"] : ["computed", "ƒ"]);
const chips = (ids) => (ids || []).filter((i) => D.sources[i]).map((i) => { const [k, s] = KIND(i);
  return `<button class="chipb ${k}" data-src="${esc(i)}" title="${esc(i)}">${s} ${k}</button>`; }).join(" ");
const src = (files, ids) => `<div class="src-line">Source: ${files.map((x) => `<code>${esc(x)}</code>`).join(" · ")} ${chips(ids)}</div>`;
const step = (n, title, body) => `<section class="step" id="s${n}"><div class="kick">${n ? `Step ${n} of 8` : ""}</div><h2>${title}</h2>${body}</section>`;
const formula = (lbl, s) => `<div class="formula"><span class="lbl">${lbl}</span>${s}</div>`;
const ex = (t, s) => `<div class="ex"><div class="t">${t}</div>${s}</div>`;
const LAYER = { own: "its own", county: "its county's", state: "its state's" };

function curveSVG(C) {
  const W = 640, H = 300, x0 = 44, y0 = 12, xr = [C.t[0], C.t[C.t.length - 1]], all = [...C.lag0, ...C.ma5], yr = [Math.min(...all) - 0.01, Math.max(...all) + 0.02];
  const X = (t) => x0 + ((t - xr[0]) / (xr[1] - xr[0])) * (W - x0 - 10), Y = (r) => y0 + (1 - (r - yr[0]) / (yr[1] - yr[0])) * (H - y0 - 34);
  const path = (rr) => C.t.map((t, i) => `${i ? "L" : "M"}${X(t).toFixed(1)},${Y(rr[i]).toFixed(1)}`).join(" ");
  const step5 = (a, b, s) => { const o = []; for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) o.push(+v.toFixed(3)); return o; };
  const ticks = step5(xr[0], xr[1], 5), span = yr[1] - yr[0], yt = step5(yr[0], yr[1], span > 0.3 ? 0.1 : 0.05);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Relative risk of death by daily mean temperature, two curve terms" style="font:12px system-ui,sans-serif">
    <rect x="${X(C.mmt)}" y="${y0}" width="${Math.max(0, X(xr[1]) - X(C.mmt))}" height="${H - y0 - 34}" fill="var(--series-2)" opacity=".08"/>
    <rect x="${X(xr[0])}" y="${y0}" width="${Math.max(0, X(C.mmt) - X(xr[0]))}" height="${H - y0 - 34}" fill="var(--series-1)" opacity=".07"/>
    ${yt.map((r) => `<line x1="${x0}" x2="${W - 10}" y1="${Y(r)}" y2="${Y(r)}" stroke="var(--grid)"/><text x="${x0 - 6}" y="${Y(r) + 4}" text-anchor="end" fill="var(--text-muted)">${r.toFixed(2)}</text>`).join("")}
    ${ticks.map((t) => `<text x="${X(t)}" y="${H - 16}" text-anchor="middle" fill="var(--text-muted)">${t} °C</text>`).join("")}
    <line x1="${x0}" x2="${W - 10}" y1="${Y(1)}" y2="${Y(1)}" stroke="var(--text-muted)"/>
    <line x1="${X(C.mmt)}" x2="${X(C.mmt)}" y1="${y0}" y2="${H - 34}" stroke="var(--text-primary)" stroke-dasharray="5 4" stroke-width="1.5"/>
    <text x="${X(C.mmt) + 6}" y="${y0 + 14}" fill="var(--text-primary)" font-weight="700">MMT ${f(C.mmt, 1)} °C</text>
    <line x1="${X(C.p99)}" x2="${X(C.p99)}" y1="${y0}" y2="${H - 34}" stroke="var(--series-2)" stroke-dasharray="2 3"/>
    <text x="${X(C.p99) - 4}" y="${H - 40}" text-anchor="end" fill="var(--series-2)">hottest 1%</text>
    <path d="${path(C.lag0)}" fill="none" stroke="var(--series-2)" stroke-width="3"/><path d="${path(C.ma5)}" fill="none" stroke="var(--series-1)" stroke-width="3" stroke-dasharray="8 5"/>
  </svg><div class="legend"><span><i style="background:var(--series-2)"></i>same-day temperature</span><span><i style="background:var(--series-1)"></i>5-day average (dashed)</span></div>`;
}

function render() {
  const R = D.ready, H = D.harm, Mp = D.mapping, Ck = D.checks, Cd = D.codify, Ru = D.rules;
  document.title = `How It Works · ${D.name}`;
  $("back").href = `index.html#${D.jurisdiction_id}/evidence/menu`;
  const docs = D.plan.docs, cs = D.coming_soon;
  const head = `<h1>How every number for ${esc(D.name)} is made</h1>
    <p class="lede">Eight steps from the plan PDFs to the chart, each with ${esc(D.name)}'s own numbers and the file and source behind them.
    Green chips are cited records, amber are team assumptions, grey are computed.</p>
    ${cs ? `<div class="soon"><b>Coming soon: insufficient curve data.</b> ${esc(cs.text)} ${chips(cs.cite)}</div>` : ""}
    <div class="warn">⚠ <b>Absolute numbers are illustrative; comparisons hold up.</b> If heat deaths are off by a constant factor, every dot, the line and the ★ move together, so
    "the plan gets X% of what the same budget could do" and "which timing wins" survive. Costs are relative tiers, not dollars.</div>`;
  // 1
  const s1 = step(1, "The plan", `<p>The documents in force for ${esc(D.name)}'s residents: ${["own", "county", "state"].filter((L) => D.plan.layers[L]).map((L) => `<b>${D.plan.layers[L]}</b> ${L === "own" ? "of its own" : `from ${L === "county" ? "its county" : "its state"}`}`).join(", ")}, ${f(D.plan.pages)} pages in all.</p>
    <div class="tbl"><table><tr><th>Document</th><th>Layer</th><th class="n">Year</th><th class="n">Pages</th></tr>
    ${docs.map((d) => `<tr><td><a href="${esc(d.pdf)}" target="_blank" rel="noopener">${esc(d.title)}</a> ${chips(d.cite)}</td><td>${esc(d.layer)}${d.from_name && d.layer !== "own" ? ` · ${esc(d.from_name)}` : ""}</td><td class="n">${esc(d.year)}</td><td class="n">${f(d.pages)}</td></tr>`).join("")}</table></div>
    ${ex("How layers work", `Its own plans are what the analysis can move. Plans it inherits from its county and state are a fixed floor, counted at their written rules.`)}
    ${src(["docs/manifest.csv", "pipeline/jurisdiction.py (plan_stack)"], [])}`);
  // 2
  const kap = Ck.kappa;
  const s2 = step(2, "Codifying the plan", `<p>Every document answers one fixed questionnaire: document questions, its triggers, and one row per commitment. Every answer carries a verbatim quote and page; silence is coded "not stated". The coder works <b>blind</b>: it never sees the evidence, costs or results.</p>
    <div class="tiles"><div class="tile"><div class="v">${f(Cd.n_doc)}</div><div class="k">document answers</div></div><div class="tile"><div class="v">${f(Cd.n_trig)}</div><div class="k">triggers</div></div>
      <div class="tile"><div class="v">${f(Cd.n_comm)}</div><div class="k">commitments</div></div><div class="tile"><div class="v">${f(Ck.quotes_ok)}/${f(Ck.quotes_n)}</div><div class="k">quotes found verbatim on their cited page</div></div></div>
    ${ex(`A real commitment · ${esc(Cd.ex.doc_id)}, page ${esc(Cd.ex.page)}`, `<blockquote>“${esc(Cd.ex.quote)}”</blockquote>
      <table>${Cd.ex.fields.map(([k, v]) => `<tr><td class="muted" style="width:40%">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table> ${chips(Cd.ex.cite)}`)}
    <h3>Checks</h3><ul>
      <li>${f(Ck.quotes_ok)} of ${f(Ck.quotes_n)} quotes are on their cited page.</li>
      ${Ck.adv_n ? `<li>${f(Ck.adv_ok)} of ${f(Ck.adv_n)} deliberately planted errors (paraphrase, wrong page, changed digit) were caught.</li>` : ""}
      ${Ck.recall ? `<li>${f(Ck.recall.ok)} of ${f(Ck.recall.n)} numbered plan actions recovered (${esc(Ck.recall.doc_id)}).</li>` : ""}
      ${kap ? `<li>Agreement with an independent second coder on ${esc(kap.doc_id)} (${kap.n} actions): κ ${kap.action_class} action class, ${kap.commitment_strength ?? "–"} strength, ${kap.status ?? "–"} status.</li>` : ""}
      <li><span class="tag t-red">Limit</span> Both coders are Claude. The human gold set has ${f(Ck.n_gold)} reviewed files, so the coding is <b>not yet human-validated</b>.</li></ul>
    ${src(["schema/codebook_v0.3.yaml", ...docs.map((d) => `extraction/${d.doc_id}.extraction.json`).slice(0, 3), "evals/quote_verification/"], [])}`);
  // 3
  const w = (v) => `${Math.max(2, (100 * v) / Math.max(1, Mp.n_comm))}%`;
  const s3 = step(3, "Commitments → strategies", `<p>Commitments become strategies keyed <b>action class | target group | hazard</b>. A plan's commitments are evidence that it runs that strategy, so results don't depend on how finely the coder split bullets.</p>
    <div class="flow">${[[Mp.n_comm, "coded commitments"], [Mp.n_scored, `scored (minus ${f(Mp.n_mention)} mention-only)`], [Mp.n_scoreable, `scoreable (minus ${f(Mp.n_excluded)} governance / assessment: counted, not scored)`]]
      .map(([v, t]) => `<div class="fr"><div class="v">${f(v)}</div><div><div class="bar" style="width:${w(v)}"></div>${t}</div></div>`).join("")}
      <div class="fr"><div class="v">${f(Mp.plan_measures)}</div><div><div class="bar" style="width:${w(Mp.plan_measures)};background:var(--series-2)"></div>own strategies: ${f(Mp.main)} event-response (<b>${f(Mp.main_firm)} firm = the plan's ★</b>) + ${f(Mp.standing)} standing; plus ${f(Mp.floor_measures)} inherited</div></div></div>
    ${ex("How each strategy is set", `<b>Target group</b>: the named group with the largest share of local deaths, else everyone.
      <b>Threshold</b>: the plan's linked trigger, else year-round. <b>Coverage</b> <span class="tag t-asm">⚠ assumed</span>: share of that group reached, from the shared menu, never read from the plan.
      <b>Firm</b>: "will / shall / must", funded, or already running.`)}
    <div class="warn">⚠ <b>Default target groups.</b> When a commitment names no specific group, it gets its class's default group (the first menu row for that class). Here that applies to <b>${f(Mp.n_default_group)} of ${f(Mp.n_scored)}</b> scored commitments${Mp.default_example ? `, e.g. ${esc(Mp.default_example.commitment_id)} filed under "${esc(Mp.default_example.label)}" ${chips(Mp.default_example.cite)}` : ""}. The app marks these "target group assumed (plan names none)".</div>
    ${src(["pipeline/commitment_mapping.py", `analysis/${D.jurisdiction_id}/commitment_mapping.csv`], [])}`);
  // 4
  const G = D.evidence.grades, col = { CONSISTENT: "var(--good)", PROMISING: "var(--series-3)", MIXED: "var(--untested)", NULL: "var(--text-muted)", HARMFUL: "var(--critical)", NO_CAUSAL: "var(--plan-ink)", NOT_REVIEWED: "var(--border)" };
  const Cl = D.classes, tot = Object.values(G).reduce((a, b) => a + b, 0);
  const s4 = step(4, "Action classes and evidence", `<p><b>${Cl.n}</b> action classes. <b>${Cl.n_paper}</b> come from the paper's review (Burke, Wilson et al. 2026, Figure 8: ${Cl.n_families} families, ${Cl.n_subgroups} intervention subgroups); <b>${Cl.n_added}</b> were added because plans contain them (${Cl.n_proxy_added} close proxies, ${Cl.n_unreviewed} unreviewed, ${Cl.n_enabling} enabling or other).</p>
    <div class="chips">${Cl.families.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
    <h3>Evidence grade (${tot} class × hazard rows)</h3>
    <div class="gbar">${Object.entries(G).map(([g, n]) => `<div style="flex:${n};background:${col[g] || "var(--text-muted)"}">${n}</div>`).join("")}</div>
    <div class="legend">${Object.keys(G).map((g) => `<span><i style="background:${col[g] || "var(--text-muted)"}"></i>${lc(g)}</span>`).join("")}</div>
    ${formula("effect band", "cut in deaths among the people reached, low to high")}
    ${ex("Examples", `<table><tr><th>Class</th><th>Grade</th><th class="n">Band</th></tr>${D.evidence.examples.map((e) => `<tr><td>${esc(e.label)} <span class="muted">(${e.hazard})</span> ${chips(e.cite)}</td><td>${lc(e.grade)}</td><td class="n" style="${e.hi <= 0 ? "color:var(--critical);font-weight:700" : ""}">${e.lo} to ${e.hi}</td></tr>`).join("")}</table>
      <p class="muted"><span class="tag t-asm">⚠ team assumption</span> bands are guided by the magnitudes the paper reports; grades are the paper's. Conservation appeals are graded harmful.</p>`)}
    ${src(["schema/action_classes.csv", "schema/evidence_table.csv"], [])}`);
  // 5
  const C = D.curve;
  const s5 = step(5, "Local harm", `<p>How many people die from heat and cold in ${esc(D.name)}, day by day: daily temperature × a published curve × usual deaths.</p>
    <div class="grid2">
      <div><span class="tag t-real">real</span> <b>Temperature</b>: NOAA nClimGrid-Daily (EpiNOAA), census tracts → county, population-weighted, ${esc(H.years)}.</div>
      <div><span class="tag t-real">real</span> <b>Deaths</b>: CDC WONDER all-cause, county × month (${esc(H.baseline_source)}).</div>
      <div><span class="tag t-real">published</span> <b>Curves</b>: EPA CIRA, ${H.n_clusters} climate clusters, ${esc(C.period)}; ${H.clusters.map(([c, n]) => `${n} ${n === 1 ? "county uses" : "counties use"} cluster ${c}`).join(", ")}.</div>
      <div><span class="tag t-asm">⚠ team decision</span> <b>Comfort point (MMT)</b>: ${esc(H.mmt_rule)} of daily mean temperature: ${esc(C.county)} ${f(C.mmt, 1)} °C.</div></div>
    <div class="curve" style="margin-top:10px"><h3>${esc(C.county)}: relative risk of death by daily mean temperature (EPA cluster ${C.cluster}, ${esc(C.period)})</h3>${curveSVG(C)}
      <p class="muted">The curve's two terms, each centred on the MMT. Each is counted where it raises risk (above 1).</p></div>
    ${formula("share of that day's deaths caused by temperature", "AF = 1 − 1 / RR(T)")}
    ${formula("heat if T is above the MMT, cold if below", "deaths<sub>day</sub> = AF × usual deaths<sub>day</sub> &nbsp;·&nbsp; a state = the sum of its counties")}
    ${ex(`${esc(D.name)}`, `<div class="tiles"><div class="tile">${H.heat_not_estimable ? `<div class="v" style="color:var(--series-2)">–</div><div class="k">heat deaths / yr: not estimable with this curve</div>` : `<div class="v" style="color:var(--series-2)">${f1(H.heat)}</div><div class="k">heat deaths / yr${H.heat_ci ? ` (95% CI ${f1(H.heat_ci[0])}–${f1(H.heat_ci[1])})` : ""}</div>`}</div>
      <div class="tile"><div class="v" style="color:var(--series-1)">${f1(H.cold)}</div><div class="k">cold deaths / yr${H.cold_ci ? ` (95% CI ${f1(H.cold_ci[0])}–${f1(H.cold_ci[1])})` : ""} ⚠ provisional</div></div>
      <div class="tile"><div class="v">${f(H.baseline)}</div><div class="k">deaths / yr from all causes</div></div>
      <div class="tile"><div class="v">${f(H.rr_hottest, 3)}</div><div class="k">relative risk on the hottest 1% of days${H.heat_per100k != null ? ` (${f(H.heat_per100k, 2)} heat deaths per 100k)` : ": the reason heat deaths can't be estimated here"}</div></div></div>`)}
    <div class="warn">⚠ <b>${esc(H.cold_warning.split(". ")[0])}.</b> ${esc(H.cold_warning.split(". ").slice(1).join(". "))}</div>
    ${cs ? `<div class="soon"><b>Why lives saved are coming soon here.</b> ${esc(cs.text)} ${cs.e6 ? `EPA's own curves for cluster ${C.cluster} by decade: ${esc(cs.e6.value)} (${esc(cs.e6.metric)}).` : ""} ${chips(cs.cite)}
      A county shows lives saved only if its relative risk on the hottest 1% of days is at least ${D.readiness.rr_min} and heat deaths are at least ${D.readiness.per100k_min} per 100k a year.</div>` : ""}
    <p class="muted">Checks: the code reproduces EPA's stored curves to ${H.e1.toExponential(0)} and EPA's own worked example to ${H.e2.toExponential(0)}; county temperatures track airport stations (median r = ${f(H.e4, 2)}).</p>
    ${src(["pipeline/response_epa.py", "pipeline/build_harm.py", `harm/harm_summary_${D.jurisdiction_id}.json`, "evals/response_eval_report.csv"], H.cite)}`);
  // 6
  const s6 = step(6, "Thresholds", `<p>One library of thresholds, checked county by county. Each strategy is switched on by one of them.</p>
    <div class="chips"><span>county's hottest ${Ru.hot.join(" / ")}% of days</span><span>coldest ${Ru.cold.join(" / ")}% of nights</span><span>daily high ≥ ${Ru.abs_hot.join(", ")} °F</span>
      <span>overnight low ≤ ${Ru.abs_cold.join(", ")} °F</span><span>seasons: ${Ru.seasons.join(", ")}</span><span>NWS alert days (N hottest days / yr)</span><span>year-round</span></div>
    <p>The plans' own ${Ru.triggers.length} triggers are converted from their coded values: <span class="tag t-real">as written</span> ${Ru.n.as_written || 0} · <span class="tag t-calc">proxy</span> ${Ru.n.proxy || 0} · <span class="tag t-asm">⚠ fallback</span> ${Ru.n.fallback || 0} · <span class="tag t-red">not convertible</span> ${Ru.n.none || 0}</p>
    <details><summary>Every trigger and how it converts</summary><div class="tbl"><table><tr><th>Trigger</th><th>Converts to</th><th>Status</th></tr>
      ${Ru.triggers.map((t) => `<tr><td>${esc(t.id)} ${chips(t.cite)}</td><td>${esc(t.text)}</td><td>${esc(t.status)}</td></tr>`).join("")}</table></div></details>
    ${formula("exact compression", `${f(Ru.county_days)} county-days → ${f(Ru.cells)} cells of days that switch the same rules on and off`)}
    ${src(["pipeline/jurisdiction.py", "pipeline/analysis_config.yaml (rule_library, trigger_fallbacks)", `analysis/${D.jurisdiction_id}/frontier_summary.json`], [])}`);
  // 7
  const formulas7 = `${formula("share of the deaths it can prevent", "r = min(1, group share × coverage) × effect")}
    ${formula("y · deaths averted per year", "y = r × deaths on the days it is switched on")}
    ${formula("x · cost, relative tiers (not $)", "cost = (fixed tier + per-30-days tier × active days / 30) × coverage ratio; &nbsp; x = cost ÷ plan cost")}`;
  let s7;
  if (R) {
    const A = D.dot.a, B = D.dot.b, Hm = D.dot.h, P = D.plan_net;
    const partRow = (p) => `${f(p.burden, 1)} × ${f(p.share, 4)} × ${f(p.cov, 2)} × ${f(p.eff, 2)} = <b>${f(p.y, 2)}</b> <span class="muted">(${p.hazard})</span>`;
    const xs = (r) => (r.x == null ? "no own-plan cost" : `${f(r.x, 1)}%`);
    s7 = step(7, "One dot, worked with real numbers", `<p>Each dot on the chart is one strategy at one threshold, run on its own.</p>${formulas7}
      ${ex(esc(A.label), `<table><tr><td class="muted">group share (${esc(A.segment)})</td><td class="n">${f(A.share, 4)}</td><td><span class="tag t-asm">⚠</span></td></tr>
        <tr><td class="muted">coverage</td><td class="n">${f(A.cov, 2)}</td><td><span class="tag t-asm">⚠</span></td></tr>
        <tr><td class="muted">effect (${lc(A.grade)}, band ${A.lo} to ${A.hi})</td><td class="n">${f(A.eff, 2)}</td><td><span class="tag t-asm">⚠</span></td></tr>
        <tr><td class="muted">cost tiers (fixed · per 30 days)</td><td class="n">${f(A.fixed)} · ${f(A.per30)}</td><td><span class="tag t-asm">⚠</span></td></tr></table>
        <div class="tbl"><table style="margin-top:8px"><tr><th>Threshold</th><th class="n">Days</th><th class="n">Deaths on them</th><th class="n">y</th><th class="n">x</th></tr>
        ${[A, B].filter(Boolean).map((r) => `<tr><td>${esc(r.rule_label)}</td><td class="n">${f(r.days)}</td><td class="n">${f(r.burden, 1)}</td><td class="n"><b>${f(r.y, 1)}</b></td><td class="n"><b>${xs(r)}</b></td></tr>`).join("")}</table></div>
        <p>${A.parts.map(partRow).join(" + ")} deaths averted / yr ${A.parts.length > 1 ? `= <b>${f(A.y, 2)}</b>` : ""}, at ${xs(A)} of the plan's cost (cost ${f(A.cost, 1)} = (${f(A.fixed)} + ${f(A.per30)} × ${f(A.days, 1)} / 30) × ${f(A.cov_ratio, 2)}).
          ${B ? `On ${esc(B.rule_label)}: <b>${f(B.y, 1)}/yr</b> at ${xs(B)}.` : ""} "Deaths on them" are what's left after the inherited plans (the floor).</p> ${chips(A.cite)}`)}
      ${Hm ? ex(`The harmful example: ${esc(Hm.label)}`, `<p>${lc(Hm.grade)} evidence, band ${Hm.lo} to ${Hm.hi}. On ${f(Hm.days)} days a year at ${f(Hm.cov, 2)} coverage: <b style="color:var(--critical)">${f(Hm.y, 1)} deaths / yr</b>.</p> ${chips(Hm.cite)}`) : ""}
      ${ex("The plan's ★ is a net figure", `<div class="netbar">${P.neg > 0 ? `<div style="flex:${P.neg};background:var(--critical)">−${f1(P.neg)}</div>` : ""}<div style="flex:${Math.max(P.pos, 1e-9)};background:var(--good)">+${f1(P.pos)}</div></div>
        <p>${f1(P.pos)} from ${P.n_pos} strategies${P.neg > 0 ? ` − ${f1(P.neg)} from ${P.n_neg} harmful` : ""} + 0 × ${P.n_zero} strategies with no causal evidence = <b>${f1(P.y)} deaths averted / yr</b> by ${esc(D.name)}'s own plans, on top of the ${f1(P.floor_y)} its inherited plans avert. ${chips(P.cite)}</p>`)}
      ${src([`analysis/${D.jurisdiction_id}/options.csv`, "pipeline/frontier.py", "schema/cost_taxonomy.csv", `analysis/${D.jurisdiction_id}/plan_measure_contributions_evidence.csv`], [])}`);
  } else {
    s7 = step(7, "One dot", `<p>Each dot on the chart is one strategy at one threshold, run on its own.</p>${formulas7}
      <div class="soon"><b>Coming soon: insufficient curve data.</b> With a flat heat curve every heat strategy here comes out at about 0, so we don't show a worked dot. ${chips(cs.cite)}</div>
      ${src(["pipeline/frontier.py", "schema/cost_taxonomy.csv"], [])}`);
  }
  // 8
  const combine = `${formula("each day, each strategy removes its share of the deaths that remain", "deaths averted = Σ<sub>days</sub> deaths × (1 − Π<sub>i</sub> (1 − r<sub>i</sub>))")}
    <p>No double counting, one threshold per strategy. The line is the best mix at every budget: multi-start greedy search plus a Pareto filter.</p>
    <div class="tbl"><table><tr><th>View</th><th>Unproven strategies count as</th></tr><tr><td><b>Evidence-backed</b> (default)</td><td>0</td></tr><tr><td>If unproven work</td><td>the middle of their band</td></tr><tr><td>Optimistic</td><td>the top of their band</td></tr></table></div>`;
  const chipsKey = `<p><button class="chipb cited">✓ cited</button> the plan's own words on the PDF page, an evidence row from the paper, or a dataset · <button class="chipb assumed">⚠ assumed</button> a team assumption with its value, basis and file · <button class="chipb computed">ƒ computed</button> the formula and the ids of every input.</p>`;
  let s8;
  if (R) {
    const Sc = D.scopes, V = D.views;
    s8 = step(8, "The best mix, and how to check it", `${combine}
      ${ex(`${esc(D.name)} at the plan's cost, evidence-backed`, `<table><tr><th>Scope</th><th class="n">Deaths averted / yr</th><th class="n">heat · cold</th></tr>
        <tr><td>Plan as written ★</td><td class="n">${f1(V.evidence.plan)}</td><td></td></tr>
        ${[["plan", "Plan's strategies, best thresholds"], ["menu", "+ shared menu"], ["standing", "+ standing policies ⚠"]].map(([k, l]) => Sc[k] ? `<tr><td>${l}</td><td class="n"><b>${f1(Sc[k].y)}</b></td><td class="n">${f1(Sc[k].y_heat)} · ${f1(Sc[k].y_cold)}</td></tr>` : "").join("")}</table>
        <p>If unproven strategies work: ${f1(V.agnostic.plan)} → ${f1(V.agnostic.standing)}. Optimistic: ${f1(V.optimistic.plan)} → ${f1(V.optimistic.standing)}.</p>
        ${Sc.standing && Sc.standing.y_cold > 0.05 ? `<div class="warn">⚠ Of the + standing figure, ${f1(Sc.standing.y_cold)} is cold. ${esc(D.warnings.cold)}</div>` : ""} ${chips(D.portfolio_cite)}`)}
      ${chipsKey}${src(["pipeline/portfolio.py", `analysis/${D.jurisdiction_id}/frontier_summary.json`, `analysis/${D.jurisdiction_id}/citations.json`], [])}`);
  } else {
    s8 = step(8, "The best mix, and how to check it", `${combine}<div class="soon"><b>Coming soon: insufficient curve data.</b> No best mix or plan ★ is shown for ${esc(D.name)} until the heat curve is fixed (see the next steps). ${chips(cs.cite)}</div>${chipsKey}
      ${src(["pipeline/portfolio.py"], [])}`);
  }
  const W = D.warnings, L = D.limits;
  const end = `<section class="step ending"><h2>What's real, what's assumed, and what's next</h2><div class="grid2">
    <div><h3 style="color:var(--good)">What's real</h3><ul><li>The plan text, every quote and page</li><li>Daily temperature, deaths, population, NWS alerts</li><li>The published EPA temperature–mortality curves</li><li>The paper's evidence grades</li></ul></div>
    <div><h3 style="color:var(--untested)">What's assumed (amber)</h3><ul><li>Effect bands, cost tiers (not dollars), coverage</li><li>Group shares of deaths</li><li>The comfort point (MMT)</li><li>Trigger fallbacks (${L.n_trig_fallback} here)</li><li>Who can pull each lever</li></ul></div>
    <div><h3 style="color:var(--critical)">Known limits</h3><ul><li><b>Cold lag</b>: ${esc(W.cold)}</li><li><b>Flat curves</b>: where the published curve shows no heat effect, lives saved are "coming soon"</li>
      <li><b>Default target groups</b>: ${f(L.n_default_group)} of ${f(W.n_scored)} scored commitments here</li><li>Group shares and reach are statewide, in every county</li><li>Usual deaths are held at 2018–24 levels</li><li>${L.n_trig_none} plan triggers here can't be converted</li>
      <li>Coding is Claude, blind, not yet human-validated (${f(W.quotes_ok)}/${f(W.quotes_n)} quotes verified; ${f(W.n_gold)} human gold files)</li></ul></div>
    <div><h3>Next steps</h3><ol><li>A longer-lag (21-day) curve for cold, then refit cold.</li><li>For flat-curve regions, use the latest period that still shows a heat effect, or calibrate to the published rate, then lift "coming soon".</li>
      <li>Fill the human gold set and publish agreement.</li><li>Replace default target groups with coded ones, flagged for review.</li><li>Dollar costs to replace the relative tiers.</li></ol></div></div></section>`;
  $("how-main").innerHTML = head + s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8 + end;
}

function openSrc(id) {
  const r = D.sources[id]; if (!r) return;
  const kv = (k, v) => (v == null || v === "" ? "" : `<div class="kv"><span class="muted">${k}</span><br><b>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</b></div>`);
  let b = `<div class="muted">${esc(id)}</div>`;
  if (r.type === "plan") {
    const url = r.pdf_url || (r.doc_id ? `docs/${r.doc_id}.pdf#page=${r.page}` : null);
    b += `${r.quote ? `<blockquote>“${esc(r.quote)}”</blockquote>` : ""}${kv("document", r.doc_id)}${kv("page", r.page)}${kv("field", r.field)}${kv("verified on page", r.verified)}${kv("value", r.value)}
      ${url ? `<p><a href="${esc(url)}" target="_blank" rel="noopener">Open the PDF at page ${esc(r.page ?? "")}</a></p>` : ""}`;
  } else if (r.type === "evidence") {
    b += `${kv("grade", r.grade)}${kv("action class", r.action_class)}${kv("hazard", r.hazard)}${kv("finding (paraphrased)", r.finding)}${kv("paper reference numbers", r.paper_refs)}${kv("effect band (team assumption)", r.band)}${kv("basis", r.band_basis)}${kv("source", r.source)}`;
  } else if (r.type === "data") {
    b += (r.rows || []).map((x) => `${kv("dataset", x.dataset)}${kv("source", x.source)}${kv("citation", x.citation)}`).join("<hr>");
  } else if (r.type === "eval") {
    b += `${kv("check", r.check)}${kv("metric", r.metric)}${kv("value", r.value)}${kv("criterion", r.criterion)}${kv("note", r.note)}${kv("file", r.file)}`;
  } else {
    b += `${kv("what", r.what || r.label)}${kv("value", r.value)}${kv("basis", r.basis)}${kv("formula", r.formula)}${kv("inputs", r.inputs)}${kv("status", r.status)}${kv("file", r.file)}`;
  }
  $("drawer-title").textContent = r.type === "plan" ? "Plan quote" : r.type === "evidence" ? "Evidence" : r.type === "data" ? "Dataset" : r.type === "eval" ? "Check" : r.type === "calc" ? "Computed" : "Assumption";
  $("drawer-body").innerHTML = b; $("drawer").hidden = false; $("drawer-x").focus();
}
document.addEventListener("click", (e) => { const c = e.target.closest("[data-src]"); if (c) openSrc(c.dataset.src); });
$("drawer-x").onclick = () => ($("drawer").hidden = true);
$("drawer").onclick = (e) => { if (e.target.id === "drawer") $("drawer").hidden = true; };
document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("drawer").hidden = true; });
$("theme").onclick = () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "light" : "dark"; try { localStorage.setItem("theme", document.documentElement.dataset.theme); } catch (e) {}
};

async function load() {
  const j = (location.hash.slice(1).split("/")[0] || "06037");
  try {
    D = await fetch(`data/${j}/method.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  } catch (e) { $("how-main").innerHTML = `<p>No walkthrough for ${esc(j)} yet. <a href="how.html#06037">Open Los Angeles County</a>.</p>`; return; }
  $("hj").value = j; render(); window.scrollTo(0, 0);
}
(async function init() {
  try {
    const J = await fetch("data/jurisdictions.json").then((r) => r.json());
    $("hj").innerHTML = J.map((x) => `<option value="${x.jurisdiction_id}">${esc(x.name)}</option>`).join("");
  } catch (e) {}
  $("hj").onchange = () => { location.hash = `#${$("hj").value}`; };
  window.addEventListener("hashchange", load);
  load();
})();
