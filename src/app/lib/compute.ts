import { Financing, Results, Scenario } from "./model";

// Paiement mensuel d’un prêt amorti (PMT)
function pmt(ratePerPeriod: number, nper: number, pv: number) {
  // ratePerPeriod ex: taux/12, pv positif ici
  if (ratePerPeriod === 0) return pv / nper;
  const r = ratePerPeriod;
  return (pv * r) / (1 - Math.pow(1 + r, -nper));
}

export function compute(actuel: Scenario, nouveau: Scenario, fin: Financing): Results {
  // IMPORTANT: ici c’est placeholder pour tous les items
  // On va remplacer avec tes vraies formules après.
  // Mais on calcule déjà le prêt pour que tu voies que ça “vit”.

  const montantFinance = Math.max(0, nouveau.coutProjetRemplacement - fin.miseDeFond);
  const payMensuelBrut = pmt(fin.tauxInteretAnnuel / 12, fin.termeAns * 12, montantFinance);
  const coutPretMensuelNet = payMensuelBrut * (1 - fin.tauxImpot);

  // Placeholder simple pour voir des chiffres bouger (on remplacera)
  const coutOperationActuel = actuel.cfm * 0.5;  // fake
  const coutOperationNouveau = nouveau.cfm * 0.4; // fake
  const economie_1an = Math.max(0, coutOperationActuel - coutOperationNouveau);
  const economie_5ans = economie_1an * 5;

  const total_1an = economie_1an;
  const total_5ans = economie_5ans;

  const coutOuGainMensuel = total_1an / 12 - coutPretMensuelNet;

  const roi_mois = total_1an > 0 ? (nouveau.coutProjetRemplacement / total_1an) * 12 : 0;

  return {
    consommation_1an: 0,
    entretien_1an: 0,
    coutOperation_annuel: coutOperationNouveau,

    economie_1an,
    economie_5ans,

    gainProductivite_1an: 0,
    gainProductivite_5ans: 0,

    total_1an,
    total_5ans,

    coutPretMensuelNet,
    coutOuGainMensuel,
    roi_mois,
  };
}