import type { Financing, Results, Scenario } from "./model";

// NOTE: This file MUST have at least one runtime export.
// We export both a named function and a default export to avoid any import mismatch.

export function compute(actuel: Scenario, nouveau: Scenario, fin: Financing): Results {
  const toNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const coutCarburant = toNum(actuel.coutCarburant);
  const heuresParSemaine = toNum(actuel.heuresParSemaine);
  const cfmActuel = toNum(actuel.cfm);
  const cfmNouveau = toNum(nouveau.cfm);

  const semaines = 52;
  const heuresAn = heuresParSemaine * semaines;

  // ⚠️ Placeholder formula (same as your current file) — adjust later with the real model.
  const coutEnergieActuel_1an = cfmActuel * heuresAn * coutCarburant;
  const coutEnergieNouveau_1an = cfmNouveau * heuresAn * coutCarburant;

  const entretienActuel_1an = 0;
  const entretienNouveau_1an = 0;

  const coutOpActuel = coutEnergieActuel_1an + entretienActuel_1an;
  const coutOpNouveau = coutEnergieNouveau_1an + entretienNouveau_1an;

  const economie_1an = coutOpActuel - coutOpNouveau;
  const economie_5ans = economie_1an * 5;

  const gainProductivite_1an = 0;
  const gainProductivite_5ans = 0;

  const total_1an = economie_1an + gainProductivite_1an;
  const total_5ans = economie_5ans + gainProductivite_5ans;

  const coutPretMensuelNet = 0;
  const coutOuGainMensuel = total_1an / 12;
  const roi_mois = 0;

  return {
    // legacy fields
    consommation_1an: coutEnergieNouveau_1an,
    entretien_1an: entretienNouveau_1an,
    coutOperation_annuel: coutOpNouveau,

    // explicit fields
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

// Default export (handy if any file is importing `compute` as default somewhere)
export default compute;

// Tiny runtime sentinel export (helps Turbopack/SSR avoid thinking the file is type-only)
export const __COMPUTE_MODULE__ = true;