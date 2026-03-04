export type YesNo = "Oui" | "Non";
export type FuelType = "Gaz Naturel" | "Propane" | "Huile #2";

export type Region =
  | "A- Montréal, Montérégie, Laurentides"
  | "B- Québec, Trois-Rivières, Estrie"
  | "C- Abitibi, Lac-Saint-Jean";

export type Scenario = {
  region: Region;

  heuresParSemaine: number;
  revenuNetParCycle: number;

  marque: string;
  typeChambre: string;
  cfm: number;

  typeBruleur: string; // "Feu direct" | "Feu indirect" | "Autre"
  modeCuisson: YesNo;
  typeCuisson: string; // ex: "Recirculation" | "100% air frais" | "Mixte" | "Autre"
  modeEconomie: YesNo;

  tempsMonteeTempMin: number;
  tempsCuissonMin: number;

  typeCarburant: FuelType;
  coutCarburant: number; // $/m3 ou $/L (selon carburant)

  cyclesParJour: number;
  reprisesParSemaine: number;
};

export type Financing = {
  coutProjet: number; // champ commun (projet unique)
  tauxInteretAnnuel: number; // ex 11,25
  termeAns: number; // ex 7
  miseDeFond: number; // $
  tauxImpot: number;
};
export type Results = {
  consommation_1an: number; // legacy
  entretien_1an: number;
  coutOperation_annuel: number; // legacy

  coutEnergieActuel_1an: number;
  coutEnergieNouveau_1an: number;

  entretienActuel_1an: number;
  entretienNouveau_1an: number;

  coutOperationActuel_annuel: number;
  coutOperationNouveau_annuel: number;

  economie_1an: number;
  economie_5ans: number;

  gainProductivite_1an: number;
  gainProductivite_5ans: number;

  total_1an: number;
  total_5ans: number;

  coutPretMensuelNet: number;
  coutOuGainMensuel: number;
  roi_mois: number;
};

export function defaultScenario(): Scenario {
  return {
    region: "A- Montréal, Montérégie, Laurentides",

    heuresParSemaine: 40,
    revenuNetParCycle: 250,

    marque: "Thermomeccanica",
    typeChambre: "Downdraft",
    cfm: 12000,

    typeBruleur: "Feu direct",
    modeCuisson: "Oui",
    typeCuisson: "Recirculation",
    modeEconomie: "Non",

    tempsMonteeTempMin: 10,
    tempsCuissonMin: 30,

    typeCarburant: "Gaz Naturel",
    coutCarburant: 0.33,

    cyclesParJour: 5,
    reprisesParSemaine: 5
  };
}

export function defaultFinancing(): Financing {
  return {
    coutProjet: 200000,
    // On stocke le taux en décimal (0.1125 = 11,25%)
    tauxInteretAnnuel: 0.1125,
    termeAns: 7,
    miseDeFond: 0,
    tauxImpot: 0.26,
  };
}