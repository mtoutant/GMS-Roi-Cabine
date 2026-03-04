"use client";
import { defaultMaintenanceConfig, loadMaintenanceConfig, saveMaintenanceConfig, resetMaintenanceConfig } from "../lib/maintenance";
import React, { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { compute } from "../lib/compute";
import { defaultFinancing, defaultScenario, Financing, Scenario } from "../lib/model";
type Tab = "Actuel" | "Nouveau" | "Paramètres & Financement" | "Résultats" | "Rapport";

function num(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function Money({ value }: { value: number }) {
  const fmt = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
  return <span>{fmt.format(value)}</span>;
}
function fmtNumber(v: any, digits = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: digits }).format(n);
}

function fmtMoney(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n);
}

function KVTable(props: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="rpt-table">
      {props.rows.map((r) => (
        <div className="rpt-row" key={r.label}>
          <div className="rpt-k">{r.label}</div>
          <div className="rpt-v">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function ReportSection(props: { title: string; children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="rpt-card">
      <div className="rpt-card-h">
        <div className="rpt-card-title">{props.title}</div>
        {props.subtitle ? <div className="rpt-card-sub">{props.subtitle}</div> : null}
      </div>
      {props.children}
    </div>
  );
}
function InputRow(props: {
  label: string;
  value: any;
  onCommit?: (v: string) => void;
}) {
  const { label, value, onCommit } = props;

  // Fix iPhone/Safari: éviter un input type="number" contrôlé.
  // On utilise text + clavier numérique, et on "commit" sur blur / Enter.
  const commit = (v: string) => {
    onCommit?.(v);
  };

  return (
    <div className="field">
      <div className="label">{label}</div>
      <input
        key={String(value ?? "")}     // force refresh si valeur change ailleurs
        className="input"
        type="text"
        inputMode="decimal"           // clavier numérique sur iOS
        defaultValue={value ?? ""}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const el = e.currentTarget;
            commit(el.value);
            el.blur();
          }
        }}
      />
    </div>
  );
}
function SelectRow(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const { label, value, onChange, options } = props;
  return (
    <div className="field">
      <div className="label">{label}</div>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
const FUEL_DEFAULT_COST: Record<string, number> = {
  "Gaz Naturel": 0.33,
  "Propane liquide": 0.95,
  "Propane": 0.95, // au cas où l'ancien libellé existe encore
  "Huile #2": 1.30,
};
export default function HomePage() {
  const [tab, setTab] = useState<Tab>("Actuel");
  const [showAdmin, setShowAdmin] = useState(false);
  const [maintenanceCfg, setMaintenanceCfg] = useState(() => defaultMaintenanceConfig);
  const [maintenanceVersion, setMaintenanceVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setMaintenanceCfg(loadMaintenanceConfig());
  }, []);

  useEffect(() => {
    if (!showAdmin) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [showAdmin]);
  const [actuel, setActuel] = useState<Scenario>(() => defaultScenario());
  const [nouveau, setNouveau] = useState<Scenario>(() => ({
    ...defaultScenario(),
    marque: "GFS",
    typeBruleur: "Feu direct",
    modeEconomie: "Oui",
    tempsMonteeTempMin: 1,
    tempsCuissonMin: 15,
    cyclesParJour: 6,
    reprisesParSemaine: 1,
  }));
const [common, setCommon] = useState(() => ({
  region: actuel.region,
  heuresParSemaine: actuel.heuresParSemaine,
  revenuNetParCycle: actuel.revenuNetParCycle,
}));
  const [fin, setFin] = useState<Financing>(() => defaultFinancing());
  const results = useMemo(() => compute(actuel, nouveau, fin), [actuel, nouveau, fin, maintenanceVersion]);

  function copyActuelToNouveau() {
    setNouveau({ ...actuel });
  }
function setCommonAndApply(patch: Partial<typeof common>) {
  setCommon((prev) => {
    const next = { ...prev, ...patch };
    setActuel((a) => ({ ...a, ...next }));
    setNouveau((n) => ({ ...n, ...next }));
    return next;
  });
}




function ScenarioForm({
  s,
  setS,
  variant,
}: {
  s: Scenario;
  setS: Dispatch<SetStateAction<Scenario>>;
  variant: "actuel" | "nouveau";
}) {
  const set = (k: keyof Scenario, v: any) => setS((prev) => ({ ...prev, [k]: v }));

  // Select fait pour layout GRID (label au-dessus)
  function SelectRowGrid(props: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
  }) {
    const { label, value, onChange, options } = props;
    return (
      <div className="field">
        <div className="label">{label}</div>
        <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Entrées</h2>
        <div className="subtle">Remplis seulement les paramètres qui changent entre Actuel et Nouveau.</div>
      </div>

      {/* --- Production --- */}
      <div className="card">
        <div className="card-title">Production</div>
        <div className="grid grid-2">
          <InputRow label="Cycles par jour" value={s.cyclesParJour} onCommit={(v) => set("cyclesParJour", v)} />
          <InputRow label="Reprises par semaine" value={s.reprisesParSemaine} onCommit={(v) => set("reprisesParSemaine", v)} />
        </div>
      </div>

      {/* --- Équipement & cuisson --- */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Équipement & cuisson</div>

        <div className="grid grid-2">
          <SelectRowGrid
            label="Marque ou comparable"
            value={s.marque}
            onChange={(v) => {
              // Toujours appliquer la marque
              setS((prev) => {
                const next: any = { ...prev, marque: v };

                // Règle demandée: Actuel + Saima => Type de cuisson = Mixte
                if (variant === "actuel" && String(v).trim().toLowerCase().includes("saima")) {
                  next.typeCuisson = "Mixte";
                }

                return next;
              });
            }}
            options={
              variant === "nouveau"
                ? ["GFS"]
                : ["Thermomeccanica", "Saima", "GFS", "Laflamme", "AG", "Autre"]
            }
          />

          <SelectRowGrid
            label="Type de chambre"
            value={s.typeChambre}
            onChange={(v) => set("typeChambre", v)}
            options={["Downdraft", "Crossdraft", "Semi-downdraft"]}
          />

          <InputRow label="CFM" value={s.cfm} onCommit={(v) => set("cfm", v)} />

          <SelectRowGrid
            label="Type de brûleur"
            value={s.typeBruleur}
            onChange={(v) => set("typeBruleur", v)}
            options={["Feu direct", "Feu indirect"]}
          />

          <SelectRowGrid
            label="Mode cuisson"
            value={s.modeCuisson}
            onChange={(v) => set("modeCuisson", v)}
            options={["Oui", "Non"]}
          />

          <SelectRowGrid
            label="Type de cuisson"
            value={s.typeCuisson}
            onChange={(v) => set("typeCuisson", v)}
            options={["Recirculation", "100% air frais", "Mixte"]}
          />

          <SelectRowGrid
            label="Mode économie"
            value={s.modeEconomie}
            onChange={(v) => set("modeEconomie", v)}
            options={["Oui", "Non"]}
          />

          {/* spacer pour garder la grille alignée proprement */}
          <div />

          <InputRow label="Temps montée en température (min)" value={s.tempsMonteeTempMin} onCommit={(v) => set("tempsMonteeTempMin", v)} />
          <InputRow label="Temps de cuisson (min)" value={s.tempsCuissonMin} onCommit={(v) => set("tempsCuissonMin", v)} />
        </div>
      </div>

      {/* --- Énergie --- */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Énergie</div>
        <div className="grid grid-2">
          <SelectRowGrid
  label="Type de carburant"
  value={s.typeCarburant}
  onChange={(v) => {
    setS((prev) => {
      const nextFuel = v;
      const prevFuel = String(prev.typeCarburant ?? "");

      const prevDefault = FUEL_DEFAULT_COST[prevFuel];
      const nextDefault = FUEL_DEFAULT_COST[nextFuel];

      const rawCost: any = (prev as any).coutCarburant;
      const costNum =
        rawCost === "" || rawCost === null || rawCost === undefined
          ? NaN
          : Number(rawCost);

      const isEmpty = rawCost === "" || rawCost === null || rawCost === undefined;
      const isZeroOrNaN = !Number.isFinite(costNum) || costNum === 0;
      const isPrevDefault =
        Number.isFinite(costNum) &&
        Number.isFinite(prevDefault) &&
        Math.abs(costNum - prevDefault) < 1e-9;

      // On overwrite le coût si:
      // - le champ est vide/0/non-numérique, OU
      // - il était exactement sur le défaut du carburant précédent
      const shouldOverwrite = isEmpty || isZeroOrNaN || isPrevDefault;

      return {
        ...prev,
        typeCarburant: nextFuel as any,
        ...(shouldOverwrite && Number.isFinite(nextDefault)
          ? { coutCarburant: String(nextDefault) }
          : {}),
      };
    });
  }}
  options={["Gaz Naturel", "Propane liquide", "Huile #2"]}
/>
          <InputRow label="Coût du carburant ($/m3 ou $/L)" value={s.coutCarburant} onCommit={(v) => set("coutCarburant", v)} />
        </div>
      </div>
    </div>
  );
}

function FinancingForm({ fin, setFin }: { fin: Financing; setFin: Dispatch<SetStateAction<Financing>> }) {
const set = (k: keyof Financing, v: any) => setFin((prev) => ({ ...prev, [k]: v }));

  return (
    <div>
      <div className="grid grid-2">
        <InputRow label="Coût du projet ($)" value={fin.coutProjet} onCommit={(v) => set("coutProjet", v)} />
        <InputRow label="Mise de fond ($)" value={fin.miseDeFond} onCommit={(v) => set("miseDeFond", v)} />
        <InputRow
          label="Taux d'intérêt annuel (%)"
          value={(() => {
            const r = Number((fin as any).tauxInteretAnnuel);
            if (!Number.isFinite(r)) return "";
            // exemple: 0.1125 -> 11.25
            const pct = r * 100;
            // enlève les .00 inutiles
            const s = String(pct);
            return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
          })()}
          onCommit={(v) => {
            // l'utilisateur peut écrire 11,25 ou 11.25
            const pct = Number(String(v).replace(",", "."));
            const dec = Number.isFinite(pct) ? pct / 100 : 0;
            set("tauxInteretAnnuel", String(dec));
          }}
        />
        <InputRow label="Terme du prêt (années)" value={fin.termeAns} onCommit={(v) => set("termeAns", v)} />
        <InputRow
          label="Taux d'impôt (%)"
          value={(() => {
            const r = Number((fin as any).tauxImpot);
            if (!Number.isFinite(r)) return "";
            // exemple: 0.26 -> 26
            const pct = r * 100;
            const s = String(pct);
            return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
          })()}
          onCommit={(v) => {
            // l'utilisateur peut écrire 26 ou 26,5 ou 26.5
            const pct = Number(String(v).replace(",", "."));
            const dec = Number.isFinite(pct) ? pct / 100 : 0;
            set("tauxImpot", String(dec));
          }}
        />
      </div>
    </div>
  );
}
function SettingsFinancingView() {
  return (
    <div className="page">
      <div className="page-head">
        <h2>Paramètres & Financement</h2>
        <div className="subtle">Champs communs aux deux scénarios + financement du projet.</div>
      </div>

      <div className="card">
        <div className="card-title">Données communes (Actuel + Nouveau)</div>
        <div className="grid grid-2">
          <SelectRow
            label="Région"
            value={common.region}
            onChange={(v) => setCommonAndApply({ region: v })}
            options={[
              "A- Montréal, Montérégie, Laurentides",
              "B- Québec, Trois-Rivières, Estrie",
              "C- Abitibi, Lac-Saint-Jean",
            ]}
          />
          <div />
          <InputRow
            label="Heures de travail / semaine"
            value={common.heuresParSemaine}
            onCommit={(v) => setCommonAndApply({ heuresParSemaine: v })}
          />
          <InputRow
            label="Revenu net par cycle ($)"
            value={common.revenuNetParCycle}
            onCommit={(v) => setCommonAndApply({ revenuNetParCycle: v })}
          />
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Financement</div>
        <FinancingForm fin={fin} setFin={setFin} />
      </div>
    </div>
  );
}
function ResultsView() {
  const ecoAn = Number(results.economie_1an || 0);
  const ecoMois = ecoAn / 12;

  const prodAn = Number(results.gainProductivite_1an || 0);
  const prodMois = prodAn / 12;

  // Crédit-bail / financement mensuel NET (après impôt)
  const creditMois = Number(results.coutPretMensuelNet || 0);

  // Net mensuel (après crédit-bail)
  const netMois = Number(results.coutOuGainMensuel || 0);
  const netAn = netMois * 12;

  // Valeur créée (avant financement)
  const brutAn = Number(results.total_1an || 0);
  const brutMois = brutAn / 12;

  // Coût d'opération annuel (énergie + entretien)
  const opActuel = Number((results as any).coutOperationActuel_annuel ?? 0);
  const opNouveau = Number((results as any).coutOperationNouveau_annuel ?? 0);

  // Bar chart sizing
  const maxOp = Math.max(opActuel, opNouveau, 1);
  const pctActuel = Math.min(100, (opActuel / maxOp) * 100);
  const pctNouveau = Math.min(100, (opNouveau / maxOp) * 100);



  // --- Projection 10 ans — 2 modes ---
  // 1) "flux"   : flux net cumulatif (inclut la fin du crédit-bail => la courbe accélère après)
  // 2) "valeur" : valeur créée cumulée (alignée avec total_1an / total_5ans)
  const [chartMode, setChartMode] = useState<"flux" | "valeur">("flux");

  const YEARS = 10;

  const valeurCreeeAnnuelle = Number(results.total_1an || 0);
  const coutCreditBailAnnuel = Number(results.coutPretMensuelNet || 0) * 12;

  // Fin de bail (années). On borne entre 1 et YEARS.
  const termeAns = Math.max(1, Math.min(YEARS, Math.round(Number((fin as any).termeAns || 0) || 1)));
  const markerYear = termeAns; // ligne verticale à la fin du crédit-bail

  // Flux net annuel d'opération (hors financement)
  const netOpAnnuelActuel = -opActuel;
  const netOpAnnuelNouveau = -opNouveau + prodAn;

  // Séries cumulatives (10 points)
  const serieActuel: number[] = [];
  const serieNouveau: number[] = [];

  let cumA = 0;
  let cumN = 0;

  for (let y = 1; y <= YEARS; y++) {
    // ACTUEL
    if (chartMode === "valeur") {
      cumA += 0;
    } else {
      cumA += netOpAnnuelActuel;
    }
    serieActuel.push(cumA);

    // NOUVEAU
    if (chartMode === "valeur") {
      // Valeur créée cumulée: valeurCreeeAnnuelle * année
      serieNouveau.push(valeurCreeeAnnuelle * y);
    } else {
      // Pendant le bail, on soustrait le crédit-bail annuel; après, 0 => pente plus forte.
      const creditCetteAnnee = y <= termeAns ? coutCreditBailAnnuel : 0;
      cumN += netOpAnnuelNouveau - creditCetteAnnee;
      serieNouveau.push(cumN);
    }
  }

  const chartTitle =
    chartMode === "valeur"
      ? "Projection 10 ans — valeur créée cumulée"
      : "Projection 10 ans — flux net cumulatif (avec fin du crédit-bail)";

  const chartSubtitle =
    chartMode === "valeur"
      ? "Valeur créée (économies + productivité) cumulée année après année."
      : "Pendant le crédit-bail, on soustrait le coût annuel";

const netAnnuel = valeurCreeeAnnuelle - coutCreditBailAnnuel;

const positive = netAnnuel >= 0;

  function BarRow(props: { label: string; value: number; pct: number; variant: "actuel" | "nouveau" }) {
    const { label, value, pct, variant } = props;
    return (
      <div className="bar-row">
        <div className="bar-left">
          <div className="bar-label">{label}</div>
          <div className="bar-sub">Coût opération annuel</div>
        </div>
        <div className="bar-mid">
          <div className="bar-track">
            <div className={`bar-fill ${variant}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="bar-right">
          <Money value={value} />
        </div>
      </div>
    );
  }

  function Kpi(props: { title: string; value: React.ReactNode; tone?: "good" | "bad" | "neutral"; sub?: string }) {
    const { title, value, tone = "neutral", sub } = props;
    return (
      <div className={`kpi kpi-${tone}`}>
        <div className="kpi-title">{title}</div>
        <div className="kpi-value">{value}</div>
        {sub ? <div className="kpi-sub">{sub}</div> : null}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Résultats</h2>
      </div>

      {/* HERO */}
      <div className={`hero ${positive ? "hero-good" : "hero-bad"}`}>
        <div className="hero-eyebrow">Gain net après crédit-bail</div>

        <div className="hero-number">
          {positive ? "+" : ""}
          <Money value={netMois} />
          <span className="hero-unit">/ mois</span>
        </div>

        <div className="hero-line">
          <span className="hero-chip">Économies</span>
          <span className="hero-math">+</span>
          <span className="hero-chip">Productivité</span>
          <span className="hero-math">−</span>
          <span className="hero-chip">Crédit-bail</span>
          <span className="hero-math">=</span>
          <span className="hero-chip strong">Net</span>
        </div>

        <div className="hero-breakdown">
          <div className="hero-break-row">
            <div>Économies estimées</div>
            <div><Money value={ecoMois} /> / mois</div>
          </div>
          <div className="hero-break-row">
            <div>Gain de productivité</div>
            <div><Money value={prodMois} /> / mois</div>
          </div>
          <div className="hero-break-row">
            <div>Crédit-bail (net)</div>
            <div>− <Money value={creditMois} /> / mois</div>
          </div>
          <div className="hero-break-row total">
            <div>Net</div>
            <div>{positive ? "+" : ""}<Money value={netMois} /> / mois</div>
          </div>
        </div>

      </div>
<div className="result-divider">
  Résultat annuel
</div>
<div className="result-annual-grid">
  <div className="result-card">
    <div className="result-label">Valeur créée</div>
    <div className="result-value">
      <Money value={valeurCreeeAnnuelle} />
    </div>
  </div>

  <div className="result-separator">–</div>

  <div className="result-card">
    <div className="result-label">Crédit-bail annuel</div>
    <div className="result-value">
      <Money value={coutCreditBailAnnuel} />
    </div>
  </div>
</div>



<div className="result-net-card">
  <div className="result-net-value">
    {positive ? "+" : ""}
    <Money value={netAnnuel} />
  </div>
</div>

      {/* COMPARAISON VISUELLE */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Comparaison visuelle — coût d’opération annuel</div>

        <div className="bars">
          <BarRow label="ACTUEL" value={opActuel} pct={pctActuel} variant="actuel" />
          <BarRow label="NOUVEAU" value={opNouveau} pct={pctNouveau} variant="nouveau" />
        </div>

        <div className="delta">
          <div className="delta-label">Économie opérationnelle annuelle estimée</div>
          <div className="delta-value"><Money value={ecoAn} /></div>
        </div>

        </div>


<div className="card roi-card" style={{ marginTop: 12 }}>
  <div className="card-title">ROI</div>

  <div className="roi-big">
    {results.roi_mois ? results.roi_mois.toFixed(1) : "—"}
    <span className="roi-unit"> mois</span>
  </div>

  <div className="subtle">Retour sur investissement estimé</div>
</div>
<div>
<div className="chart-head">

  <div className="chart-title">{chartTitle}</div>
  
  <div className="chart-actions">
    <button
      type="button"
      className={`btn ${chartMode === "flux" ? "btn-active" : ""}`}
      onClick={() => setChartMode("flux")}
    >
      Flux net
    </button>

    <button
      type="button"
      className={`btn ${chartMode === "valeur" ? "btn-active" : ""}`}
      onClick={() => setChartMode("valeur")}
    >
      Valeur créée
    </button>
  </div>

  <div className="chart-subtitle">
    {chartSubtitle}
  </div>
</div>

        <div style={{ marginTop: 12 }}>
<TenYearNetChart actuel={serieActuel} nouveau={serieNouveau} markerYear={markerYear} theme="dark" />
        
        </div>
      </div>
      <button className="btn btn-primary" onClick={() => setTab("Rapport")}>
        Ouvrir le rapport (pour PDF)
      </button>
    </div>
  );
}
function FieldTable({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <table className="report-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            <td style={{ fontWeight: 800, color: "#111827" }}>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
function ReportView() {
  // Recalcule ici comme dans ResultsView (ou tu passes les valeurs en props)
  const ecoAn = Number(results.economie_1an || 0);
  const prodAn = Number(results.gainProductivite_1an || 0);
  const creditMois = Number(results.coutPretMensuelNet || 0);
  const netMois = Number(results.coutOuGainMensuel || 0);

  const valeurCreeeAnnuelle = Number(results.total_1an || 0);
  const coutCreditBailAnnuel = creditMois * 12;
  const netAnnuel = valeurCreeeAnnuelle - coutCreditBailAnnuel;
// --- Série 10 ans pour le rapport (flux net cumulatif) ---
const YEARS = 10;

const opActuel = Number((results as any).coutOperationActuel_annuel ?? 0);
const opNouveau = Number((results as any).coutOperationNouveau_annuel ?? 0);

const netOpAnnuelActuel = -opActuel;
const netOpAnnuelNouveau = -opNouveau + prodAn;

const termeAns = Math.max(1, Math.min(YEARS, Math.round(Number((fin as any).termeAns || 0) || 1)));
const markerYear = termeAns;

const serieActuel: number[] = [];
const serieNouveau: number[] = [];

let cumA = 0;
let cumN = 0;

for (let y = 1; y <= YEARS; y++) {
  cumA += netOpAnnuelActuel;
  serieActuel.push(cumA);

  const creditCetteAnnee = y <= termeAns ? coutCreditBailAnnuel : 0;
  cumN += netOpAnnuelNouveau - creditCetteAnnee;
  serieNouveau.push(cumN);
}
  // Tes séries déjà prêtes dans ResultsView? Sinon refais la même logique 10 ans ici.
  // -> idéal: extraire la génération de série dans une petite fonction partagée.

  const rowsCommonActuel = [
    { label: "Région", value: actuel.region },
    { label: "Heures / semaine", value: actuel.heuresParSemaine },
    { label: "Revenu net par cycle", value: <Money value={Number(actuel.revenuNetParCycle)} /> },
    { label: "Cycles / jour", value: actuel.cyclesParJour },
    { label: "Reprises / semaine", value: actuel.reprisesParSemaine },
    { label: "Marque", value: actuel.marque },
    { label: "Type de chambre", value: actuel.typeChambre },
    { label: "CFM", value: actuel.cfm },
    { label: "Brûleur", value: actuel.typeBruleur },
    { label: "Cuisson", value: actuel.modeCuisson },
    { label: "Type de cuisson", value: actuel.typeCuisson },
    { label: "Économie", value: actuel.modeEconomie },
    { label: "Montée temp (min)", value: actuel.tempsMonteeTempMin },
    { label: "Cuisson (min)", value: actuel.tempsCuissonMin },
    { label: "Carburant", value: actuel.typeCarburant },
    { label: "Coût carburant", value: actuel.coutCarburant },
  ];

  const rowsCommonNouveau = [
    { label: "Région", value: nouveau.region },
    { label: "Heures / semaine", value: nouveau.heuresParSemaine },
    { label: "Revenu net par cycle", value: <Money value={Number(nouveau.revenuNetParCycle)} /> },
    { label: "Cycles / jour", value: nouveau.cyclesParJour },
    { label: "Reprises / semaine", value: nouveau.reprisesParSemaine },
    { label: "Marque", value: nouveau.marque },
    { label: "Type de chambre", value: nouveau.typeChambre },
    { label: "CFM", value: nouveau.cfm },
    { label: "Brûleur", value: nouveau.typeBruleur },
    { label: "Cuisson", value: nouveau.modeCuisson },
    { label: "Type de cuisson", value: nouveau.typeCuisson },
    { label: "Économie", value: nouveau.modeEconomie },
    { label: "Montée temp (min)", value: nouveau.tempsMonteeTempMin },
    { label: "Cuisson (min)", value: nouveau.tempsCuissonMin },
    { label: "Carburant", value: nouveau.typeCarburant },
    { label: "Coût carburant", value: nouveau.coutCarburant },
  ];

  const rowsFin = [
    { label: "Coût du projet", value: <Money value={Number(fin.coutProjet)} /> },
    { label: "Mise de fond", value: <Money value={Number(fin.miseDeFond)} /> },
    { label: "Taux d’intérêt", value: `${(Number(fin.tauxInteretAnnuel) * 100).toFixed(2)} %` },
    { label: "Terme", value: `${fin.termeAns} ans` },
    { label: "Taux d’impôt", value: `${(Number(fin.tauxImpot) * 100).toFixed(2)} %` },
  ];

  return (
    <div className="report">
      <div className="report-header">
        <div className="report-brand">
          <img src="/GMSTC_Logo_FondBlanc.png" className="report-logo" alt="GMS" />
          <div>
            <h1 className="report-title">Retour sur investissement — Chambre à peinture</h1>
            <div className="report-subtitle">Rapport généré depuis l’app</div>
          </div>
        </div>

        <div style={{ textAlign: "right", color: "#6b7280", fontSize: 12 }}>
          {new Date().toLocaleDateString("fr-CA")}
        </div>
      </div>

      <div className="report-section report-grid-2">
        <div className="report-card report-kpi">
          <div style={{ color: "#6b7280", fontWeight: 800 }}>Gain net après crédit-bail</div>
          <div className="kpi-big"><Money value={netMois} /> / mois</div>
          <div style={{ marginTop: 6, color: "#6b7280" }}>
            Net annuel: <strong style={{ color: "#111827" }}><Money value={netAnnuel} /></strong>
          </div>
        </div>

        <div className="report-card report-kpi">
          <div style={{ color: "#6b7280", fontWeight: 800 }}>ROI estimé</div>
          <div className="kpi-big">{results.roi_mois ? results.roi_mois.toFixed(1) : "—"} mois</div>
          <div style={{ marginTop: 6, color: "#6b7280" }}>
            Crédit-bail: <strong style={{ color: "#111827" }}><Money value={creditMois} /></strong> / mois
          </div>
        </div>
      </div>

<div className="report-section">
  <div className="report-h2">Projection — 10 ans (flux net cumulatif)</div>
  <div className="report-note">Ligne verticale = fin du crédit-bail.</div>
<TenYearNetChart actuel={serieActuel} nouveau={serieNouveau} markerYear={markerYear} theme="light" />
</div>

      <div className="report-section">
        <div className="report-h2">Comparaison — coût d’opération annuel</div>

        {(() => {
          const opA = Number((results as any).coutOperationActuel_annuel ?? 0);
          const opN = Number((results as any).coutOperationNouveau_annuel ?? 0);
          const maxOp = Math.max(opA, opN, 1);
          const pctA = Math.min(100, (opA / maxOp) * 100);
          const pctN = Math.min(100, (opN / maxOp) * 100);
          const eco = Number(results.economie_1an || 0);

          const Row = (p: { label: string; value: number; pct: number; color: string }) => (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 130px", gap: 12, alignItems: "center", marginTop: 10 }}>
              <div style={{ fontWeight: 900, color: "#111827" }}>{p.label}</div>
              <div style={{ height: 12, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${p.pct}%`, height: "100%", background: p.color, borderRadius: 999 }} />
              </div>
              <div style={{ textAlign: "right", fontWeight: 900, color: "#111827" }}>{fmtMoney(p.value)}</div>
            </div>
          );

          return (
            <div className="report-card" style={{ padding: 16 }}>
              <Row label="ACTUEL" value={opA} pct={pctA} color="#9ca3af" />
              <Row label="NOUVEAU" value={opN} pct={pctN} color="#f97316" />

              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 12, border: "1px dashed rgba(249,115,22,0.55)", background: "rgba(249,115,22,0.08)" }}>
                <div style={{ fontWeight: 900, color: "#111827" }}>Économie opérationnelle annuelle estimée</div>
                <div style={{ fontWeight: 1000, color: "#111827" }}>{fmtMoney(eco)}</div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="report-section report-grid-2">
        <div className="report-card">
          <div className="report-h2">Entrées — Actuel</div>
          <FieldTable rows={rowsCommonActuel} />
        </div>
        <div className="report-card">
          <div className="report-h2">Entrées — Nouveau</div>
          <FieldTable rows={rowsCommonNouveau} />
        </div>
      </div>

      <div className="report-section">
        <div className="report-card">
          <div className="report-h2">Financement</div>
          <FieldTable rows={rowsFin} />
        </div>
      </div>

      {/* bouton visible à l'écran, caché à l'impression via @media print */}
      <button onClick={() => window.print()} className="btn btn-primary" style={{ marginTop: 14 }}>
        Exporter PDF (Imprimer)
      </button>
    </div>
  );
}
function AdminMaintenanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

const setFilter = (brand: any, chamber: any, v: string) => {
  setMaintenanceCfg((prev) => ({
    ...prev,
    filters: {
      ...prev.filters,
      [brand]: {
        ...(prev.filters?.[brand] ?? { downdraft: 0, semi: 0, cross: 0 }),
        [chamber]: Number(v) || 0,
      },
    },
  }));
};

const setCooking = (brand: any, key: "oui" | "non", v: string) => {
  setMaintenanceCfg((prev) => ({
    ...prev,
    cooking: {
      ...prev.cooking,
      [brand]: {
        ...(prev.cooking?.[brand] ?? { oui: 0, non: 0 }),
        [key]: Number(v) || 0,
      },
    },
  }));
};
const setFilterNote = (brand: any, chamber: any, v: string) => {
  setMaintenanceCfg((prev) => ({
    ...prev,
    notes: {
      ...(prev as any).notes,
      filters: {
        ...((prev as any).notes?.filters ?? {}),
        [brand]: {
          ...(((prev as any).notes?.filters?.[brand]) ?? { downdraft: "", semi: "", cross: "" }),
          [chamber]: v,
        },
      },
    },
  }));
};

const setCookingNote = (brand: any, key: "oui" | "non", v: string) => {
  setMaintenanceCfg((prev) => ({
    ...prev,
    notes: {
      ...(prev as any).notes,
      cooking: {
        ...((prev as any).notes?.cooking ?? {}),
        [brand]: {
          ...(((prev as any).notes?.cooking?.[brand]) ?? { oui: "", non: "" }),
          [key]: v,
        },
      },
    },
  }));
};
  const save = () => {
    saveMaintenanceConfig(maintenanceCfg);
    setMaintenanceVersion((v) => v + 1);
    setToast("✅ Sauvegardé");
    onClose();
    window.setTimeout(() => setToast(null), 1200);
  };

  const reset = () => {
    resetMaintenanceConfig();
    setMaintenanceCfg(defaultMaintenanceConfig);
    setMaintenanceVersion((v) => v + 1);
    setToast("↩️ Valeurs par défaut appliquées");
    window.setTimeout(() => setToast(null), 1400);
  };

  const brands = ["saima", "thermomeccanica", "gfs", "laflamme_ag", "other"] as const;
  const chambers = ["downdraft", "semi", "cross"] as const;

  const adminPanelStyle: React.CSSProperties = {
    background: "#111827",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  const adminCardStyle: React.CSSProperties = {
    background: "#0f172a",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  const adminInputStyle: React.CSSProperties = {
    background: "#0b1220",
    color: "#ffffff",
    border: "1px solid rgba(255,255,255,0.18)",
  };

  const adminHintStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    lineHeight: 1.2,
  };

  const adminRowStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "140px 160px 1fr",
    gap: 10,
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  };

  const adminSectionNoteStyle: React.CSSProperties = {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 6,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.75)", // plus foncé
        backdropFilter: "blur(4px)", // effet pro
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 1000,
      }}
      onClick={save}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "85vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          ...adminPanelStyle,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 20 }}>Admin — Coûts de maintenance</div>
            <div className="subtle">Modifie les valeurs. Fermer = sauvegarder.</div>
          </div>

          <button
            onClick={save}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "#fff",
              lineHeight: 1,
            }}
            title="Fermer"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 14, ...adminCardStyle }} className="card">
          <div className="card-title">Filtres (par marque × type de chambre)</div>
          <div style={adminSectionNoteStyle}>Montants en $ / année. Ces valeurs alimentent le calcul d’entretien (filtres) selon la marque et le type de chambre.</div>

          {brands.map((b) => (
            <div key={b} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{b}</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...adminRowStyle, fontWeight: 900, color: "rgba(255,255,255,0.85)", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
                  <div>Type</div>
                  <div>Valeur</div>
                  <div>Note (mémo)</div>
                </div>

                {chambers.map((c) => (
                  <div key={c} style={adminRowStyle}>
                    <div className="label" style={{ margin: 0 }}>{c}</div>
                    <input
                      className="input"
                      style={adminInputStyle}
                      defaultValue={maintenanceCfg.filters?.[b]?.[c] ?? maintenanceCfg.filters?.other?.[c] ?? 0}
                      onBlur={(e) => setFilter(b, c, e.target.value)}
                    />
                    <input
                      className="input"
                      style={{ ...adminInputStyle, fontSize: 12 }}
                      placeholder="Note (mémo calcul / hypothèse)"
                      defaultValue={(maintenanceCfg as any).notes?.filters?.[b]?.[c] ?? ""}
                      onBlur={(e) => setFilterNote(b, c, e.target.value)}
                    />
                  </div>
                ))}

              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14, ...adminCardStyle }} className="card">
          <div className="card-title">Entretien - Cuisson (Oui/Non par marque)</div>
          <div style={adminSectionNoteStyle}>Montants en $ / année. Surcoût d’entretien ajouté selon le mode cuisson (Oui/Non) et la marque.</div>
          {brands.map((b) => (
            <div key={b} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{b}</div>
              <div style={{ marginTop: 8 }}>
                <div style={{ ...adminRowStyle, fontWeight: 900, color: "rgba(255,255,255,0.85)", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
                  <div>Mode</div>
                  <div>Valeur</div>
                  <div>Note (mémo)</div>
                </div>

                <div style={adminRowStyle}>
                  <div className="label" style={{ margin: 0 }}>oui</div>
                  <input
                    className="input"
                    style={adminInputStyle}
                    defaultValue={maintenanceCfg.cooking?.[b]?.oui ?? maintenanceCfg.cooking?.other?.oui ?? 0}
                    onBlur={(e) => setCooking(b, "oui", e.target.value)}
                  />
                  <input
                    className="input"
                    style={{ ...adminInputStyle, fontSize: 12 }}
                    placeholder="Note (mémo calcul / hypothèse)"
                    defaultValue={(maintenanceCfg as any).notes?.cooking?.[b]?.oui ?? ""}
                    onBlur={(e) => setCookingNote(b, "oui", e.target.value)}
                  />
                </div>

                <div style={adminRowStyle}>
                  <div className="label" style={{ margin: 0 }}>non</div>
                  <input
                    className="input"
                    style={adminInputStyle}
                    defaultValue={maintenanceCfg.cooking?.[b]?.non ?? maintenanceCfg.cooking?.other?.non ?? 0}
                    onBlur={(e) => setCooking(b, "non", e.target.value)}
                  />
                  <input
                    className="input"
                    style={{ ...adminInputStyle, fontSize: 12 }}
                    placeholder="Note (mémo calcul / hypothèse)"
                    defaultValue={(maintenanceCfg as any).notes?.cooking?.[b]?.non ?? ""}
                    onBlur={(e) => setCookingNote(b, "non", e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn" onClick={reset}>Reset valeurs par défaut</button>
        </div>
      </div>
    </div>
  );
}
  return (
    <>
<div className="topbar">
  <div className="topbar-inner column-center">

<img
  src="/GMSTC_Logo_FondBlanc.png"
  alt="GMS Logo"
  className="brand-logo"
  title="Clic = site GMSTC | Double-clic = admin"
  style={{ cursor: "pointer" }}
  onClick={(e) => {
    e.preventDefault();

    // petit délai pour laisser la chance au double-clic
    const timeout = setTimeout(() => {
      window.open("https://www.gmstc.ca/entreprises", "_blank");
    }, 300);

    // on stocke le timeout dans l'élément
    (e.currentTarget as any)._clickTimeout = timeout;
  }}
  onDoubleClick={(e) => {
    e.preventDefault();

    // annule l'ouverture du site
    clearTimeout((e.currentTarget as any)._clickTimeout);

    setShowAdmin(true);
  }}
/>

    {/* Titre */}
    <h1 className="main-title">
      Retour sur investissement – Chambre à peinture
    </h1>

    {/* Onglets */}
    <div className="tabs">
      {(["Actuel", "Nouveau", "Paramètres & Financement", "Résultats"] as Tab[]).map((t) => (
        <button
          key={t}
          className={`btn ${tab === t ? "btn-active" : ""}`}
          onMouseDown={() => (document.activeElement as HTMLElement | null)?.blur()}
          onClick={() => setTab(t)}
        >
          {t}
        </button>
      ))}
    </div>

  </div>
</div>

      <div className="container">
        {tab === "Actuel" && <ScenarioForm key="actuel" s={actuel} setS={setActuel} variant="actuel" />}
        {tab === "Nouveau" && <ScenarioForm key="nouveau" s={nouveau} setS={setNouveau} variant="nouveau" />}
        {tab === "Paramètres & Financement" && <SettingsFinancingView />}
        {tab === "Résultats" && <ResultsView />}
        {tab === "Rapport" && <ReportView />}
      </div>
      <AdminMaintenanceModal open={showAdmin} onClose={() => setShowAdmin(false)} />
      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: 18,
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.16)",
            zIndex: 2000,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

function TenYearNetChart(props: {
  actuel: number[];
  nouveau: number[];
  markerYear: number;
  theme?: "dark" | "light";
}) {
  const { actuel, nouveau, markerYear, theme = "dark" } = props;

  const COLORS =
    theme === "light"
      ? {
          bg: "#f8fafc",
          grid: "#e5e7eb",
          axis: "#6b7280",
          actuel: "#9ca3af", // gris (garder)
          nouveau: "#f97316", // orange (changer)
          ptActuel: "#9ca3af",
          ptNouveau: "#f97316",
          vline: "rgba(17,24,39,0.35)",
          vlabel: "#111827",
          legendText: "#111827",
        }
      : {
          bg: "rgba(17,24,39,0.35)",
          grid: "rgba(255,255,255,0.10)",
          axis: "rgba(255,255,255,0.75)",
          actuel: "rgba(255,255,255,0.85)",
          nouveau: "#f97316",
          ptActuel: "rgba(255,255,255,0.95)",
          ptNouveau: "#f97316",
          vline: "rgba(255,255,255,0.28)",
          vlabel: "#ffffff",
          legendText: "#ffffff",
        };

  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: 0,
    }).format(v);

  const years = Math.min(actuel.length, nouveau.length);
  if (years < 2) return null;

  const maxY = Math.max(...actuel, ...nouveau, 1);
  const minY = Math.min(...actuel, ...nouveau, 0);
  const range = Math.max(1, maxY - minY);

  const W = 900;
  const H = 280;
  const padL = 64;
  const padR = 18;
  const padT = 16;
  const padB = 46;

  const x = (i: number) => padL + (i * (W - padL - padR)) / (years - 1);
  const y = (v: number) => padT + ((maxY - v) * (H - padT - padB)) / range;

  const pathFor = (arr: number[]) =>
    arr
      .slice(0, years)
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => {
    const t = minY + (range * i) / yTicks;
    return { v: t, y: y(t) };
  });

  const markerIndex = Math.min(Math.max(1, markerYear), years) - 1;
  const markerX = x(markerIndex);

  return (
    <div className="chart-wrap">
      <div className="chart-legend" style={{ color: COLORS.legendText, fontWeight: 800 }}>
        <div className="legend-item">
          <span className="dot dot-actuel" /> Garder la cabine
        </div>
        <div className="legend-item">
          <span className="dot dot-nouveau" /> Changer de cabine
        </div>
      </div>

      <div className="chart-box" style={{ background: COLORS.bg }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="280" role="img" aria-label="Projection 10 ans">
          {/* grid + labels Y */}
          {ticks.map((t, idx) => (
            <g key={idx}>
              <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} style={{ stroke: COLORS.grid, strokeWidth: 1 }} />
              <text x={10} y={t.y + 4} style={{ fill: COLORS.axis, fontSize: 12, fontWeight: 700 }}>
                {fmt(t.v)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {Array.from({ length: years }, (_, i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 16}
              textAnchor="middle"
              style={{ fill: COLORS.axis, fontSize: 12, fontWeight: 700 }}
            >
              {i + 1}
            </text>
          ))}

          {/* Vertical marker */}
          <line
            x1={markerX}
            x2={markerX}
            y1={padT}
            y2={H - padB}
            style={{ stroke: COLORS.vline, strokeWidth: 2, strokeDasharray: "6 6" }}
          />
          <text x={markerX + 6} y={padT + 14} style={{ fill: COLORS.vlabel, fontSize: 12, fontWeight: 800 }}>
            Fin crédit-bail (année {markerYear})
          </text>

          {/* lines */}
          <path d={pathFor(actuel)} style={{ fill: "none", stroke: COLORS.actuel, strokeWidth: 4 }} />
          <path d={pathFor(nouveau)} style={{ fill: "none", stroke: COLORS.nouveau, strokeWidth: 4 }} />

          {/* points */}
          {actuel.slice(0, years).map((v, i) => (
            <circle key={`a-${i}`} cx={x(i)} cy={y(v)} r={4.5} style={{ fill: COLORS.ptActuel }} />
          ))}
          {nouveau.slice(0, years).map((v, i) => (
            <circle key={`n-${i}`} cx={x(i)} cy={y(v)} r={4.5} style={{ fill: COLORS.ptNouveau }} />
          ))}
        </svg>
      </div>

      <div
        className="chart-foot"
        style={{
          color: COLORS.legendText,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 12,
          alignItems: "center",
          justifyItems: "center",
        }}
      >
        <div style={{ whiteSpace: "nowrap", justifySelf: "start" }}>
          Année {years} — Garder :{" "}
          <strong style={{ color: COLORS.legendText }}>{fmt(actuel[years - 1] ?? 0)}</strong>
        </div>
        <div style={{ whiteSpace: "nowrap", justifySelf: "end" }}>
          Année {years} — Changer :{" "}
          <strong style={{ color: COLORS.legendText }}>{fmt(nouveau[years - 1] ?? 0)}</strong>
        </div>
        <div
          className="chart-delta"
          style={{
            color: COLORS.legendText,
            gridColumn: "2 / 3",
            textAlign: "center",
            whiteSpace: "nowrap",
            marginTop: 4,
          }}
        >
          Différence :{" "}
          <strong style={{ color: COLORS.legendText }}>
            {fmt((nouveau[years - 1] ?? 0) - (actuel[years - 1] ?? 0))}
          </strong>
        </div>
      </div>
    </div>
  );
}