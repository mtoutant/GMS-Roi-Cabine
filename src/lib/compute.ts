import { Financing, Results, Scenario } from "./model";
import { defaultMaintenanceConfig, loadMaintenanceConfig, type MaintenanceConfig } from "./maintenance";

// Paiement mensuel d’un prêt amorti (PMT)
function pmt(ratePerPeriod: number, nper: number, pv: number) {
  if (ratePerPeriod === 0) return pv / nper;
  const r = ratePerPeriod;
  return (pv * r) / (1 - Math.pow(1 + r, -nper));
}

// robust: accepte numbers, strings vides, etc.
function safe(n: any) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

// ------------------- ÉNERGIE (coût $/an) -------------------

const REGION_COEFF: Record<string, number> = {
  "A- Montréal, Montérégie, Laurentides": 6.78,
  "B- Québec, Trois-Rivières, Estrie": 7.79,
  "C- Abitibi, Lac-Saint-Jean": 8.91
};

const FUEL_HEATVALUE: Record<string, number> = {
  "Gaz Naturel": 35910,
  "Propane": 24180,
  "Huile #2": 36600
};

const DEFAULT_FUEL_COST: Record<string, number> = {
  "Gaz Naturel": 0.33,
  "Propane": 0.95,
  "Huile #2": 1.30
};

function annualEnergyCost(s: Scenario, economyReduction: number): number {
  const regionCoeff = REGION_COEFF[String((s as any).region)] ?? 6.78;
  const heatValue = FUEL_HEATVALUE[String((s as any).typeCarburant)] ?? 35910;

  const userFuel = safe((s as any).coutCarburant);
  const fuelCost = userFuel > 0 ? userFuel : (DEFAULT_FUEL_COST[String((s as any).typeCarburant)] ?? 0);

  const cyclesWeek = (s.modeCuisson === "Oui") ? safe(s.cyclesParJour) * 5 : 0;

  const sprayHoursWeek =
    safe(s.heuresParSemaine) - cyclesWeek * (safe(s.tempsCuissonMin) / 60);

  const baseSpray = (safe(s.cfm) * regionCoeff) * (sprayHoursWeek) / 168;

  const sprayWithEco = baseSpray * (1 - safe(economyReduction));
  const sprayConsumption = (s.modeEconomie === "Oui") ? sprayWithEco : baseSpray;
  const sprayCost = sprayConsumption * fuelCost;

  const a13 = (safe(s.cfm) * 100) / heatValue;

  const isAirFrais100 = (String((s as any).typeCuisson) === "100% air frais");

  const cookCost100AirFrais =
    (safe(s.cyclesParJour) * 5) *
    ((safe(s.tempsCuissonMin) + safe(s.tempsMonteeTempMin)) / 60) *
    52 *
    a13 *
    fuelCost;

  const cookCostRecirc =
    ((safe(s.cyclesParJour) * 5 * 52) * ((a13 / 60) * safe(s.tempsMonteeTempMin))) * fuelCost +
    ((((safe(s.cyclesParJour) * 5) * 52) * (safe(s.tempsCuissonMin) / 60)) * (a13 * 0.3)) * fuelCost;

  const cookCost = isAirFrais100 ? cookCost100AirFrais : cookCostRecirc;

  const totalBeforeBurner =
    (s.modeCuisson === "Oui") ? (sprayCost + cookCost) : sprayCost;

  const burnerMultiplier = (s.typeBruleur === "Feu indirect") ? 1.3 : 1.0;

  return totalBeforeBurner * burnerMultiplier;
}

// ------------------- ENTRETIEN (marque + type chambre + cuisson) -------------------

function norm(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("–", "-")
    .replaceAll("—", "-");
}

function chamberKey(typeChambre: any): "downdraft" | "semi" | "cross" {
  const t = norm(typeChambre);
  if (t.includes("semi")) return "semi";
  if (t.includes("cross")) return "cross";
  return "downdraft";
}

function brandKey(marque: any): "saima" | "thermomeccanica" | "gfs" | "laflamme_ag" | "other" {
  const b = norm(marque);

  if (b.includes("saima")) return "saima";
  if (b.includes("thermo")) return "thermomeccanica";
  if (b.includes("gfs")) return "gfs";
  if (b.includes("laflamme") || b.includes("ag")) return "laflamme_ag";

  return "other";
}

function annualMaintenanceFilters(s: Scenario, cfg: MaintenanceConfig): number {
  const chamber = chamberKey((s as any).typeChambre);
  const brand = brandKey((s as any).marque);

  return cfg.filters[brand]?.[chamber] ?? cfg.filters.other[chamber];
}

function annualMaintenanceCooking(s: Scenario, cfg: MaintenanceConfig): number {
  const brand = brandKey((s as any).marque);
  const cuissonOui = (s as any).modeCuisson === "Oui";
  const rec = cfg.cooking[brand] ?? cfg.cooking.other;
  return cuissonOui ? rec.oui : rec.non;
}

function annualMaintenanceTotal(s: Scenario, cfg: MaintenanceConfig): number {
  return annualMaintenanceFilters(s, cfg) + annualMaintenanceCooking(s, cfg);
}

function annualProductivityGain(actuel: Scenario, nouveau: Scenario): { gain1: number; gain5: number } {
  const revPerCycle = safe((actuel as any).revenuNetParCycle);

  // On convertit les heures/semaine en "jours équivalents" (8h/jour)
  // Exemple: 40h => 5 jours.
  const heuresSem = safe((actuel as any).heuresParSemaine);
  const joursEq = Math.max(0, heuresSem / 8);

  // Cycles planifiés/semaine (peut différer Actuel vs Nouveau)
  const cyclesWeekActuel = safe((actuel as any).cyclesParJour) * joursEq;
  const cyclesWeekNouveau = safe((nouveau as any).cyclesParJour) * joursEq;

  // Reprises/semaine (rework) => ça consomme des cycles
  const reprisesActuel = safe((actuel as any).reprisesParSemaine);
  const reprisesNouveau = safe((nouveau as any).reprisesParSemaine);

  // Cycles net/semaine (après reprises)
  const cyclesNetActuel = cyclesWeekActuel - reprisesActuel;
  const cyclesNetNouveau = cyclesWeekNouveau - reprisesNouveau;

  // Gain de cycles/semaine (si négatif, on met 0: pas de "gain")
  const gainCyclesWeek = Math.max(0, cyclesNetNouveau - cyclesNetActuel);

  const gain1 = gainCyclesWeek * revPerCycle * 52;
  const gain5 = gain1 * 5;

  return { gain1, gain5 };
}
// ------------------- COMPUTE GLOBAL -------------------

export function compute(actuel: Scenario, nouveau: Scenario, fin: Financing): Results {
  // --- Prêt ---
  const montantFinance = Math.max(0, safe((fin as any).coutProjet) - safe(fin.miseDeFond));
  const payMensuelBrut = pmt(safe(fin.tauxInteretAnnuel) / 12, safe(fin.termeAns) * 12, montantFinance);
  const coutPretMensuelNet = payMensuelBrut * (1 - safe(fin.tauxImpot));

  // --- Énergie annuelle ---
  const coutEnergieActuel = annualEnergyCost(actuel, 0.20);
  const coutEnergieNouveau = annualEnergyCost(nouveau, 0.30);

const maintenanceCfg =
  typeof window === "undefined" ? defaultMaintenanceConfig : loadMaintenanceConfig();

const entretienActuel = annualMaintenanceTotal(actuel, maintenanceCfg);
const entretienNouveau = annualMaintenanceTotal(nouveau, maintenanceCfg);

  // --- Entretien annuel ---
 // const entretienActuel = annualMaintenanceTotal(actuel);
 // const entretienNouveau = annualMaintenanceTotal(nouveau);

  // --- Coût d'opération annuel (énergie + entretien) ---
  const coutOpActuel = coutEnergieActuel + entretienActuel;
  const coutOpNouveau = coutEnergieNouveau + entretienNouveau;


  // --- Productivité ---
  const prod = annualProductivityGain(actuel, nouveau);

  const economie_1an = coutOpActuel - coutOpNouveau;
  const economie_5ans = economie_1an * 5;

  // Totaux = économies + productivité
  const total_1an = economie_1an + prod.gain1;
  const total_5ans = economie_5ans + prod.gain5;

  const coutOuGainMensuel = total_1an / 12 - coutPretMensuelNet;
  const roi_mois = total_1an > 0 ? (safe((fin as any).coutProjet) / total_1an) * 12 : 0;

  return {
    coutEnergieActuel_1an: coutEnergieActuel,
    coutEnergieNouveau_1an: coutEnergieNouveau,

    entretienActuel_1an: entretienActuel,
    entretienNouveau_1an: entretienNouveau,

    consommation_1an: coutEnergieNouveau, // legacy
    entretien_1an: entretienNouveau,
    coutOperationNouveau_annuel: coutOpNouveau,
    coutOperationActuel_annuel: coutOpActuel,

    economie_1an,
    economie_5ans,

    gainProductivite_1an: prod.gain1,
    gainProductivite_5ans: prod.gain5,
    total_1an,
    total_5ans,

    coutPretMensuelNet,
    coutOuGainMensuel,
    roi_mois
  };
}