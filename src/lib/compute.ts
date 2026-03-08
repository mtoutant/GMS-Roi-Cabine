import type { Financing, Results, Scenario } from "./model";

// Paiement mensuel (PMT) prêt amorti
function pmt(ratePerPeriod: number, nper: number, pv: number) {
  if (!Number.isFinite(ratePerPeriod) || ratePerPeriod === 0) return pv / nper;
  const r = ratePerPeriod;
  return (r * pv) / (1 - Math.pow(1 + r, -nper));
}

export function compute(actuel: Scenario, nouveau: Scenario, fin: Financing): Results {
  // Parse des nombres saisis en FR/EN (ex: "1 234,56", "1 234,56", "$1,234.56", "26%", "4.58e05")
  const toNum = (v: any): number => {
    if (v === null || v === undefined) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;

    let raw = String(v).trim();
    if (!raw) return 0;

    // normalise espaces (incluant NBSP et NNBSP)
    raw = raw.replace(/[\u00A0\u202F\s]/g, "");

    // Garde chiffres / séparateurs / signe / notation scientifique
    // (on enlève monnaie, %, lettres, etc.)
    raw = raw.replace(/[^0-9,\.\-eE\+]/g, "");
    if (!raw || raw === "-" || raw === "." || raw === ",") return 0;

    // Support exponent (ex: 4.58e05, 1,2E-3)
    const parts = raw.split(/[eE]/);
    const mantissaRaw = parts[0];
    const expRaw = parts.length > 1 ? parts.slice(1).join("") : "";

    let s = mantissaRaw;
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");

    // Si les deux existent, le dernier rencontré est le séparateur décimal.
    // L'autre devient un séparateur de milliers à supprimer.
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        // decimal = comma
        s = s.replace(/\./g, "");
        s = s.replace(/,/g, ".");
      } else {
        // decimal = dot
        s = s.replace(/,/g, "");
      }
    } else if (lastComma !== -1 && lastDot === -1) {
      // seulement des virgules -> assume virgule décimale
      s = s.replace(/,/g, ".");
    }

    // Recompose avec exponent si présent (on garde + / -)
    if (expRaw) {
      const expClean = expRaw.replace(/[^0-9\+\-]/g, "");
      s = `${s}e${expClean}`;
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const semaines = 52;

  // --- COMMUN / BASE ---
  const heuresParSemaine = toNum(actuel.heuresParSemaine);
  const revenuNetParCycle = toNum(actuel.revenuNetParCycle);

  // --- ÉNERGIE (aligné Excel V.2 : dépend cycles/temps + mode économie) ---
  // Notes Excel :
  // - "Mode économie" = -30% sur la portion "spray/ventilation" (A19 -> A23 = -30%)
  // - Recirculation pendant cuisson = facteur 0.3
  // - Feu indirect = +30% (x1.3)
  // - Les reprises ne sont PAS intégrées au calcul énergie dans le fichier Excel V.2

  const coutCarburantActuel = toNum(actuel.coutCarburant);
  const coutCarburantNouveau = toNum(nouveau.coutCarburant);

  const cfmActuel = toNum(actuel.cfm);
  const cfmNouveau = toNum(nouveau.cfm);

  const cyclesJourActuel = toNum(actuel.cyclesParJour);
  const cyclesJourNouveau = toNum(nouveau.cyclesParJour);

  const joursOuvresSem = 5;

  const monteeA = toNum(actuel.tempsMonteeTempMin);
  const cuissonA = toNum(actuel.tempsCuissonMin);
  const monteeN = toNum(nouveau.tempsMonteeTempMin);
  const cuissonN = toNum(nouveau.tempsCuissonMin);

  // Facteur région (Excel: Coût d'opération!H11)
  const regionFactorByRegion: Record<string, number> = {
    "A- Montréal, Montérégie, Laurentides": 6.78,
    "B- Québec, Trois-Rivières, Estrie": 7.79,
    "C- Abitibi, Lac-Saint-Jean": 8.91,
  };
  const regionFactor = regionFactorByRegion[String(actuel.region)] ?? 6.78;

  // Constantes carburant (Excel: Calculs!L12-L14)
  const fuelConst: Record<string, number> = {
    "Gaz Naturel": 35910,
    "Propane liquide": 24180,
    "Propane": 24180,
    "Huile #2": 36600,
  };

  function energieExcelLike(s: {
    cfm: number;
    cyclesJour: number;
    monteeMin: number;
    cuissonMin: number;
    coutCarburant: number;
    typeCarburant: string;
    modeCuisson: string;
    typeCuisson: string;
    modeEconomie: string;
    typeBruleur: string;
  }): number {
    const modeCuissonOui = String(s.modeCuisson) === "Oui";
    const lowCuisson = String(s.typeCuisson).toLowerCase();
    const isRecirc = lowCuisson.includes("recirc");
    const isAirForce = lowCuisson.includes("air forc");
    const isFeuIndirect = String(s.typeBruleur).toLowerCase().includes("indirect");

    const cyclesSem = modeCuissonOui ? s.cyclesJour * joursOuvresSem : 0;
    const cyclesAn = cyclesSem * semaines;

    // --- Spray/Ventilation (Excel A19) ---
    const sprayHoursSem = Math.max(0, heuresParSemaine - cyclesSem * (s.cuissonMin / 60));

    const A19 = (s.cfm * regionFactor) * (sprayHoursSem / 168);
    const A23 = A19 * 0.7;

    const sprayBase = String(s.modeEconomie) === "Oui" ? A23 : A19;
    const sprayCost = sprayBase * s.coutCarburant;

    // --- Cuisson / chauffe (Excel A31 / A25) ---
    let cuissonCost = 0;
    if (modeCuissonOui) {
      const k = fuelConst[String(s.typeCarburant)] ?? 35910;
      const A13 = (s.cfm * 100) / k;

      if (isAirForce) {
        const A25 = cyclesAn * ((s.cuissonMin + s.monteeMin) / 60) * A13;
        cuissonCost = A25 * s.coutCarburant;
      } else {
        const cuissonFactor = isRecirc ? 0.3 : 1;
        const A31 =
          cyclesAn * ((A13 / 60) * s.monteeMin) +
          cyclesAn * (s.cuissonMin / 60) * (A13 * cuissonFactor);
        cuissonCost = A31 * s.coutCarburant;
      }
    }

    let total = sprayCost + cuissonCost;
    if (isFeuIndirect) total *= 1.3;
    return total;
  }

  const coutEnergieActuel_1an = energieExcelLike({
    cfm: cfmActuel,
    cyclesJour: cyclesJourActuel,
    monteeMin: monteeA,
    cuissonMin: cuissonA,
    coutCarburant: coutCarburantActuel,
    typeCarburant: String(actuel.typeCarburant),
    modeCuisson: String(actuel.modeCuisson),
    typeCuisson: String(actuel.typeCuisson),
    modeEconomie: String(actuel.modeEconomie),
    typeBruleur: String(actuel.typeBruleur),
  });

  const coutEnergieNouveau_1an = energieExcelLike({
    cfm: cfmNouveau,
    cyclesJour: cyclesJourNouveau,
    monteeMin: monteeN,
    cuissonMin: cuissonN,
    coutCarburant: coutCarburantNouveau,
    typeCarburant: String(nouveau.typeCarburant),
    modeCuisson: String(nouveau.modeCuisson),
    typeCuisson: String(nouveau.typeCuisson),
    modeEconomie: String(nouveau.modeEconomie),
    typeBruleur: String(nouveau.typeBruleur),
  });

  // --- ENTRETIEN (aligné Excel V.2 : filtres + cuisson, par marque et type de chambre) ---
  const filtersCostByBrandAndChamber: Record<string, Record<string, number>> = {
    Saima: { Downdraft: 4900, "Semi-downdraft": 2240, Crossdraft: 2660 },
    Thermomeccanica: { Downdraft: 4900, "Semi-downdraft": 2240, Crossdraft: 2660 },
    Thermomecanica: { Downdraft: 4900, "Semi-downdraft": 2240, Crossdraft: 2660 },

    GFS: { Downdraft: 4120, "Semi-downdraft": 2430, Crossdraft: 2020 },

    "Laflamme / AG": { Downdraft: 1575, "Semi-downdraft": 1575, Crossdraft: 1575 },
    Laflamme: { Downdraft: 1575, "Semi-downdraft": 1575, Crossdraft: 1575 },
    AG: { Downdraft: 1575, "Semi-downdraft": 1575, Crossdraft: 1575 },

    Autre: { Downdraft: 0, "Semi-downdraft": 0, Crossdraft: 0 },
  };

  const cookingMaintByBrand: Record<string, { Oui: number; Non: number }> = {
    Saima: { Oui: 2254, Non: 1164 },
    Thermomeccanica: { Oui: 2254, Non: 1164 },
    Thermomecanica: { Oui: 2254, Non: 1164 },
    GFS: { Oui: 1164, Non: 1164 },
    "Laflamme / AG": { Oui: 1164, Non: 1164 },
    Laflamme: { Oui: 1164, Non: 1164 },
    AG: { Oui: 1164, Non: 1164 },
    Autre: { Oui: 1164, Non: 1164 },
  };

  function normalizeBrand(raw: any): string {
    const s = String(raw ?? "").trim();
    if (!s) return "Autre";

    const low = s.toLowerCase();
    if (low.includes("gfs")) return "GFS";
    if (low.includes("saima")) return "Saima";
    if (low.includes("thermo")) return "Thermomeccanica";
    if (low.includes("laflamme") || low.includes(" ag")) return "Laflamme / AG";
    return s;
  }

  function normalizeChamber(raw: any): string {
    const s = String(raw ?? "").trim();
    const low = s.toLowerCase();
    if (low.includes("semi")) return "Semi-downdraft";
    if (low.includes("cross")) return "Crossdraft";
    return "Downdraft";
  }

  function entretienExcelLike(s: { marque: any; typeChambre: any; modeCuisson: any }): number {
    const brand = normalizeBrand(s.marque);
    const chamber = normalizeChamber(s.typeChambre);

    const filters =
      (filtersCostByBrandAndChamber[brand] ?? filtersCostByBrandAndChamber.Autre)?.[chamber] ?? 0;

    const cuissonKey: "Oui" | "Non" = String(s.modeCuisson) === "Oui" ? "Oui" : "Non";
    const cook = (cookingMaintByBrand[brand] ?? cookingMaintByBrand.Autre)[cuissonKey] ?? 0;

    return filters + cook;
  }

  const entretienActuel_1an = entretienExcelLike({
    marque: actuel.marque,
    typeChambre: actuel.typeChambre,
    modeCuisson: actuel.modeCuisson,
  });

  const entretienNouveau_1an = entretienExcelLike({
    marque: nouveau.marque,
    typeChambre: nouveau.typeChambre,
    modeCuisson: nouveau.modeCuisson,
  });

  // --- COÛT D'OPÉRATION ---
  const coutOpActuel = coutEnergieActuel_1an + entretienActuel_1an;
  const coutOpNouveau = coutEnergieNouveau_1an + entretienNouveau_1an;

  const economie_1an = coutOpActuel - coutOpNouveau;
  const economie_5ans = economie_1an * 5;

  // --- PRODUCTIVITÉ ---
  // On inclut les reprises dans la productivité (logique demandée côté app)
  const diffCyclesJour = cyclesJourNouveau - cyclesJourActuel;
const reprisesSemActuel = toNum(actuel.reprisesParSemaine);
const reprisesSemNouveau = toNum(nouveau.reprisesParSemaine);

// positif = moins de reprises = plus de cycles payants
const diffReprisesSem = reprisesSemActuel - reprisesSemNouveau;

  const gainProductivite_1an =
    (diffCyclesJour * joursOuvresSem * semaines + diffReprisesSem * semaines) * revenuNetParCycle;
  const gainProductivite_5ans = gainProductivite_1an * 5;

  const total_1an = economie_1an + gainProductivite_1an;
  const total_5ans = economie_5ans + gainProductivite_5ans;

  // --- FINANCEMENT ---
  const coutProjet = Math.max(0, toNum(fin.coutProjet));
  const miseDeFond = Math.max(0, toNum(fin.miseDeFond));
  const pv = Math.max(0, coutProjet - miseDeFond);

  const tauxInteretAnnuel = Math.max(0, toNum(fin.tauxInteretAnnuel)); // ex 0.1125
  const termeAns = Math.max(1, toNum(fin.termeAns));
  const tauxImpot = Math.min(0.9, Math.max(0, toNum(fin.tauxImpot))); // ex 0.26

  const paiementMensuel = pmt(tauxInteretAnnuel / 12, termeAns * 12, pv);

  // Hypothèse simple: paiement déductible -> coût net après impôt
  const coutPretMensuelNet = paiementMensuel * (1 - tauxImpot);

  const coutOuGainMensuel = total_1an / 12 - coutPretMensuelNet;

  // ROI en mois: projet / valeur créée annuelle * 12
  const roi_mois = total_1an > 0 ? (coutProjet / total_1an) * 12 : 0;

  return {
    // legacy
    consommation_1an: coutEnergieNouveau_1an,
    entretien_1an: entretienNouveau_1an,
    coutOperation_annuel: coutOpNouveau,

    coutEnergieActuel_1an,
    coutEnergieNouveau_1an,

    entretienActuel_1an,
    entretienNouveau_1an,

    coutOperationActuel_annuel: coutOpActuel,
    coutOperationNouveau_annuel: coutOpNouveau,

    economie_1an,
    economie_5ans,

    gainProductivite_1an,
    gainProductivite_5ans,

    total_1an,
    total_5ans,

    coutPretMensuelNet,
    coutOuGainMensuel,
    roi_mois,
  };
}