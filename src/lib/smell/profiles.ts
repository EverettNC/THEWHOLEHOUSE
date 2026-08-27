/**
 * Live inventory: 21 profiles. Catalog of 26 is not used here.
 * Source: EverettNC/OpenSmell opensmell_engine_truth.json
 * Do not bloat. Do not invent 2401.
 */
import type { SmellProfile } from "./types";

export const LIVE_PROFILES: SmellProfile[] = [
  { key: "alzheimers", condition: "Alzheimer's Disease", category: "neurological", severity: "high", channels: ["lipid_oxidation"] },
  { key: "bladder_cancer", condition: "Bladder Cancer", category: "cancer", severity: "critical", channels: ["alkanes", "benzene"] },
  { key: "breast_cancer", condition: "Breast Cancer", category: "cancer", severity: "critical", channels: ["aliphatic_acids", "hydrocarbons"] },
  { key: "c_diff", condition: "C. difficile", category: "infectious", severity: "high", channels: ["aliphatic_acids", "propanol", "skatole"] },
  { key: "colorectal_cancer", condition: "Colorectal Cancer", category: "cancer", severity: "critical", channels: ["ammonia", "sulfur", "skatole"] },
  { key: "covid19", condition: "COVID-19", category: "infectious", severity: "high", channels: ["isoprene", "aldehydes"] },
  { key: "depressive_spiral", condition: "Depressive Spiral", category: "psychiatric", severity: "high", channels: ["dimethyl_sulfide", "acetone"] },
  { key: "diabetes_type1", condition: "Diabetes (Type 1)", category: "metabolic", severity: "high", channels: ["acetone"] },
  { key: "diabetes_type2", condition: "Diabetes (Type 2)", category: "metabolic", severity: "high", channels: ["acetone"] },
  { key: "fight_or_flight", condition: "Fight-or-Flight Escalation", category: "psychiatric", severity: "critical", channels: ["isoprene", "ammonia"] },
  { key: "ketoacidosis", condition: "Ketoacidosis", category: "metabolic", severity: "critical", channels: ["acetone", "propanol"] },
  { key: "liver_disease", condition: "Liver Disease", category: "metabolic", severity: "high", channels: ["dimethyl_sulfide"] },
  { key: "lung_cancer", condition: "Lung Cancer", category: "cancer", severity: "critical", channels: ["alkanes", "benzene", "aldehydes"] },
  { key: "ovarian_cancer", condition: "Ovarian Cancer", category: "cancer", severity: "critical", channels: ["aldehydes", "hydrocarbons"] },
  { key: "parkinsons", condition: "Parkinson's Disease", category: "neurological", severity: "high", channels: ["sebum_vocs", "aldehydes"] },
  { key: "pre_seizure", condition: "Pre-Seizure / Fit Warning", category: "psychiatric", severity: "critical", channels: ["ammonia", "alkanes"] },
  { key: "prostate_cancer", condition: "Prostate Cancer", category: "cancer", severity: "critical", channels: ["aldehydes", "ketones"] },
  { key: "rage_cortisol", condition: "Rage / Cortisol Spike", category: "psychiatric", severity: "high", channels: ["acetone", "isoprene"] },
  { key: "renal_failure", condition: "Renal Failure", category: "metabolic", severity: "critical", channels: ["ammonia", "dimethyl_sulfide", "toluene"] },
  { key: "sepsis", condition: "Sepsis", category: "infectious", severity: "critical", channels: ["aliphatic_acids", "ammonia", "dimethyl_sulfide"] },
  { key: "tuberculosis", condition: "Tuberculosis", category: "infectious", severity: "critical", channels: ["alkanes"] },
];

export const LIVE_PROFILE_COUNT = 21;
