export type Chamber = "downdraft" | "semi" | "cross";
export type Brand = "saima" | "thermomeccanica" | "gfs" | "laflamme_ag" | "other";

export type MaintenanceConfig = {
  filters: Record<Brand, Record<Chamber, number>>;
  cooking: Record<Brand, { oui: number; non: number }>;
  notes: {
    filters: Record<Brand, Record<Chamber, string>>;
    cooking: Record<Brand, { oui: string; non: string }>;
  };
};

export const defaultMaintenanceConfig: MaintenanceConfig = {
  filters: {
    saima: { downdraft: 4900, semi: 2240, cross: 2660 },
    thermomeccanica: { downdraft: 4900, semi: 2240, cross: 2660 },
    gfs: { downdraft: 4120, semi: 2430, cross: 2020 },
    laflamme_ag: { downdraft: 1575, semi: 1915, cross: 2335 },
    other: { downdraft: 4900, semi: 2240, cross: 2660 },
  },

  cooking: {
    saima: { oui: 2254, non: 1164 },
    thermomeccanica: { oui: 2254, non: 1164 },
    gfs: { oui: 1164, non: 1164 },
    laflamme_ag: { oui: 1164, non: 1164 },
    other: { oui: 1164, non: 1164 },
  },

  notes: {
    filters: {
      saima: { downdraft: "", semi: "", cross: "" },
      thermomeccanica: { downdraft: "", semi: "", cross: "" },
      gfs: { downdraft: "", semi: "", cross: "" },
      laflamme_ag: { downdraft: "", semi: "", cross: "" },
      other: { downdraft: "", semi: "", cross: "" },
    },
    cooking: {
      saima: { oui: "", non: "" },
      thermomeccanica: { oui: "", non: "" },
      gfs: { oui: "", non: "" },
      laflamme_ag: { oui: "", non: "" },
      other: { oui: "", non: "" },
    },
  },
};

const KEY = "gms_roi_maintenance_config_v1";

export function loadMaintenanceConfig(): MaintenanceConfig {
  if (typeof window === "undefined") return defaultMaintenanceConfig;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultMaintenanceConfig;

    const cfg = JSON.parse(raw) as MaintenanceConfig;

    // sécurité si anciennes configs sans notes
    cfg.notes ??= defaultMaintenanceConfig.notes;

    return cfg;
  } catch {
    return defaultMaintenanceConfig;
  }
}

export function saveMaintenanceConfig(cfg: MaintenanceConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function resetMaintenanceConfig() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}