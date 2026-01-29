/**
 * Al-Gomhouria Lab - Comprehensive Medical Tests Database
 * Based on "Lab to Lab" Catalog standards (April 2024 V11)
 * Includes: Methods, TAT, Stability, Reference Ranges, and Formulas.
 */

const medicalTests = {
    // ========================================================================
    // 1. CLINICAL CHEMISTRY (الكيمياء الإحيائية)
    // ========================================================================
    "LiverFunction": {
        name: "Liver Function (وظائف الكبد)",
        category: "Chemistry",
        sampleType: "Serum", tubeCap: "Yellow",
        instructions: "Patient should be fasting (Optional)",
        price: 450.00,
        parameters: [
            { id: "alt", name: "ALT (SGPT)", unit: "U/L", range: "Up to 41" },
            { id: "ast", name: "AST (SGOT)", unit: "U/L", range: "Up to 40" },
            { id: "tp", name: "Total Protein", unit: "g/dL", range: "6.6 - 8.3" },
            { id: "alb", name: "Albumin", unit: "g/dL", range: "3.5 - 5.2" },
            { id: "glob", name: "Globulin", unit: "g/dL", calculated: true },
            { id: "ag_ratio", name: "A/G Ratio", unit: "-", calculated: true },
            { id: "bil_t", name: "Bilirubin Total", unit: "mg/dL", range: "0.1 - 1.2" },
            { id: "bil_d", name: "Bilirubin Direct", unit: "mg/dL", range: "Up to 0.3" },
            { id: "bil_i", name: "Bilirubin Indirect", unit: "mg/dL", calculated: true }
        ],
        calculations: (v) => {
            if (v.tp && v.alb) v.glob = (v.tp - v.alb).toFixed(1);
            if (v.alb && v.glob) v.ag_ratio = (v.alb / v.glob).toFixed(2);
            if (v.bil_t && v.bil_d) v.bil_i = (v.bil_t - v.bil_d).toFixed(2);
            return v;
        }
    },

    "KidneyFunction": {
        name: "Kidney Function (وظائف الكلى)",
        category: "Chemistry",
        sampleType: "Serum", tubeCap: "Yellow",
        price: 300.00,
        parameters: [
            { id: "urea", name: "Blood Urea", unit: "mg/dL", range: "15 - 45" },
            { id: "creath", name: "Creatinine (Serum)", unit: "mg/dL", range: "0.6 - 1.3" },
            { id: "uric", name: "Uric Acid", unit: "mg/dL", range: "3.5 - 7.2" },
            { id: "bun", name: "B.U.N", unit: "mg/dL", calculated: true }
        ],
        calculations: (v) => {
            if (v.urea) v.bun = (v.urea / 2.14).toFixed(1);
            return v;
        }
    },

    "LipidProfile": {
        name: "Lipid Profile (دهنيات الدم صائم)",
        category: "Chemistry",
        sampleType: "Serum", tubeCap: "Yellow",
        method: "Enzymatic Colorimetric",
        tat: "Same Day",
        preparation: "Fasting 12 - 14 hours mandatory",
        parameters: [
            { id: "chol", name: "Total Cholesterol", unit: "mg/dL", range: "Up to 200", method: "CHOD-PAP" },
            { id: "tg", name: "Triglycerides", unit: "mg/dL", range: "Up to 150", method: "GPO-PAP" },
            { id: "hdl", name: "HDL - Cholesterol", unit: "mg/dL", range: "> 40 (Low Risk)", method: "Direct" },
            { id: "vldl", name: "VLDL - Cholesterol", unit: "mg/dL", calculated: true, range: "Up to 30" },
            { id: "ldl", name: "LDL - Cholesterol (Bad)", unit: "mg/dL", calculated: true, range: "Up to 130" },
            { id: "risk", name: "Risk Ratio (CHOL/HDL)", unit: "Ratio", calculated: true, range: "Up to 5.0" }
        ],
        calculations: (v) => {
            if (v.tg) v.vldl = (v.tg / 5).toFixed(1);
            if (v.chol && v.hdl && v.vldl) v.ldl = (v.chol - v.hdl - v.vldl).toFixed(1);
            if (v.chol && v.hdl) v.risk = (v.chol / v.hdl).toFixed(2);
            return v;
        }
    },

    "CardiacMarkers": {
        name: "Cardiac Markers Profile (إنزيمات القلب)",
        category: "Chemistry",
        sampleType: "Serum", tubeCap: "Yellow / Green (Heparin)",
        tat: "2 - 4 Hours (Emergency)",
        parameters: [
            { id: "trop_i", name: "Troponin I (High Sensitivity)", unit: "ng/mL", range: "Up to 0.04", method: "CMIA" },
            { id: "ck_mb", name: "CK-MB (Mass)", unit: "ng/mL", range: "Up to 5.0", method: "CMIA" },
            { id: "ck_total", name: "CK (Total)", unit: "U/L", range: { male: "Up to 190", female: "Up to 167" } },
            { id: "ldh", name: "LDH", unit: "U/L", range: "135 - 225", method: "IFCC" },
            { id: "myo", name: "Myoglobin", unit: "ng/mL", range: "Up to 70" }
        ]
    },

    "DiabetesProfile": {
        name: "Diabetes Management Profile (ملف السكر)",
        category: "Chemistry",
        tat: "Same Day",
        parameters: [
            { id: "fbs", name: "Fasting Blood Sugar", unit: "mg/dL", range: "70 - 110", preparation: "8 - 10h Fasting" },
            { id: "ppbs", name: "2Hr Post Prandial Blood Sugar", unit: "mg/dL", range: "Up to 140", preparation: "2h After meal" },
            { id: "rbs", name: "Random Blood Sugar", unit: "mg/dL", range: "70 - 140" },
            { id: "hba1c", name: "HbA1c (Glycated Hemoglobin)", unit: "%", range: "4.8 - 6.0 (Normal)", method: "HPLC" },
            { id: "insulin", name: "Insulin (Fasting)", unit: "uIU/mL", range: "2.6 - 24.9" },
            { id: "homa_ir", name: "HOMA-IR (Insulin Resistance)", unit: "index", calculated: true, range: "Up to 2.5" }
        ],
        calculations: (v) => {
            if (v.fbs && v.insulin) v.homa_ir = ((v.fbs * v.insulin) / 405).toFixed(2);
            return v;
        }
    },

    // ========================================================================
    // 2. HEMATOLOGY (أمراض الدم)
    // ========================================================================
    "CBC": {
        name: "Complete Blood Count (صورة دم كاملة)",
        category: "Hematology",
        sampleType: "Whole Blood", tubeCap: "Purple (EDTA)",
        method: "Automated Cell Counter (V-Diff)",
        tat: "2 Hours",
        parameters: [
            { id: "hb", name: "Hemoglobin (HGB)", unit: "g/dL", range: { male: "13.5 - 17.5", female: "12 - 15.5" } },
            { id: "rbc", name: "RBCs Count", unit: "10^6/uL", range: "4.5 - 5.9" },
            { id: "hct", name: "Hematocrit (PCV)", unit: "%", range: "40 - 52" },
            { id: "mcv", name: "MCV", unit: "fL", range: "80 - 100" },
            { id: "mch", name: "MCH", unit: "pg", range: "27 - 32" },
            { id: "mchc", name: "MCHC", unit: "g/dL", range: "32 - 36" },
            { id: "wbc", name: "Total WBCs Count", unit: "10^3/uL", range: "4 - 11" },
            { id: "plt", name: "Platelets (PLT)", unit: "10^3/uL", range: "150 - 450" },
            { id: "neut_p", name: "Neutrophils %", unit: "%", range: "40 - 75" },
            { id: "lymph_p", name: "Lymphocytes %", unit: "%", range: "20 - 45" },
            { id: "mono_p", name: "Monocytes %", unit: "%", range: "2 - 10" },
            { id: "eos_p", name: "Eosinophils %", unit: "%", range: "1 - 6" },
            { id: "baso_p", name: "Basophils %", unit: "%", range: "0 - 1" }
        ],
        calculations: (v) => {
            if (v.hb && !v.hct) v.hct = (v.hb * 3).toFixed(1);
            if (v.hct && v.rbc) v.mcv = ((v.hct / v.rbc) * 10).toFixed(1);
            if (v.hb && v.rbc) v.mch = ((v.hb / v.rbc) * 10).toFixed(1);
            if (v.hb && v.hct) v.mchc = ((v.hb / v.hct) * 100).toFixed(1);
            return v;
        }
    },

    "CoagulationProfile": {
        name: "Coagulation Profile (سيولة الدم)",
        category: "Hematology",
        sampleType: "Plasma", tubeCap: "Blue (Na Citrate)",
        tat: "Same Day",
        preparation: "Tube must be filled exactly to the mark",
        parameters: [
            { id: "pt_sec", name: "PT (Patient)", unit: "sec", range: "11 - 14" },
            { id: "pt_con", name: "PT (Control)", unit: "sec", range: "12.0" },
            { id: "pt_act", name: "PT (Activity)", unit: "%", range: "70 - 100" },
            { id: "inr", name: "INR (International Normalized Ratio)", unit: "ratio", range: "0.8 - 1.2" },
            { id: "ptt", name: "PTT (Activated)", unit: "sec", range: "25 - 35" }
        ]
    },

    "ESR": {
        name: "ESR (Westergren Method)",
        category: "Hematology",
        sampleType: "Whole Blood / Citrate",
        tat: "2 Hours",
        parameters: [
            { id: "esr1", name: "ESR (1st Hour)", unit: "mm/hr", range: { male: "Up to 15", female: "Up to 20" } },
            { id: "esr2", name: "ESR (2nd Hour)", unit: "mm/hr", range: "Optional" }
        ]
    },

    // ========================================================================
    // 3. HORMONES & TUMOR MARKERS (الهرمونات والدلالات)
    // ========================================================================
    "ThyroidProfile": {
        name: "Thyroid Profile (الغدة الدرقية كاملة)",
        category: "Hormones",
        sampleType: "Serum", tubeCap: "Yellow",
        method: "ECLIA / CMIA",
        tat: "Same Day",
        parameters: [
            { id: "tsh", name: "TSH (Ultrasensitive)", unit: "uIU/mL", range: "0.27 - 4.2" },
            { id: "ft3", name: "Free T3", unit: "pg/mL", range: "2.0 - 4.4" },
            { id: "ft4", name: "Free T4", unit: "ng/dL", range: "0.9 - 1.7" },
            { id: "t3", name: "Total T3", unit: "ng/dL", range: "80 - 200" },
            { id: "t4", name: "Total T4", unit: "ug/dL", range: "5.1 - 14.1" },
            { id: "tpo", name: "TPO Antibodies", unit: "IU/mL", range: "Up to 34" }
        ]
    },

    "FertilityMale": {
        name: "Male Fertility Profile (هرمونات الذكورة)",
        category: "Hormones",
        parameters: [
            { id: "testo_t", name: "Testosterone (Total)", unit: "ng/dL", range: "240 - 870" },
            { id: "testo_f", name: "Testosterone (Free)", unit: "pg/mL", range: "4.5 - 25" },
            { id: "prolactin", name: "Prolactin", unit: "ng/mL", range: "4.0 - 15.2" },
            { id: "fsh", name: "FSH", unit: "mIU/mL", range: "1.5 - 12.4" },
            { id: "lh", name: "LH", unit: "mIU/mL", range: "1.7 - 8.6" }
        ]
    },

    "FertilityFemale": {
        name: "Female Fertility Profile (هرمونات الأنوثة)",
        category: "Hormones",
        preparation: "Usually done on 2nd or 3rd day of cycle",
        parameters: [
            { id: "fsh", name: "FSH", unit: "mIU/mL", range: "Follicular: 3.5 - 12.5" },
            { id: "lh", name: "LH", unit: "mIU/mL", range: "Follicular: 2.4 - 12.6" },
            { id: "e2", name: "Estradiol (E2)", unit: "pg/mL", range: "Follicular: 24 - 151" },
            { id: "prolactin", name: "Prolactin", unit: "ng/mL", range: "6.0 - 23.3" },
            { id: "amh", name: "AMH (Anti-Mullerian Hormone)", unit: "ng/mL", range: "Normal: 1.0 - 3.0" }
        ]
    },

    "TumorMarkersFull": {
        name: "Tumor Markers Comprehensive (دلالات الأورام)",
        category: "Hormones",
        parameters: [
            { id: "afp", name: "AFP (Alpha Fetoprotein)", unit: "ng/mL", range: "Up to 7.0" },
            { id: "cea", name: "CEA (Carcinoembryonic Antigen)", unit: "ng/mL", range: "Up to 5.0" },
            { id: "psa_t", name: "PSA Total", unit: "ng/mL", range: "Up to 4.0" },
            { id: "psa_f", name: "PSA Free", unit: "ng/mL", range: "N/A" },
            { id: "psa_ratio", name: "PSA Ratio (F/T)", unit: "%", calculated: true, range: "> 25%" },
            { id: "ca125", name: "CA-125 (Ovarian)", unit: "U/mL", range: "Up to 35" },
            { id: "ca15_3", name: "CA 15.3 (Breast)", unit: "U/mL", range: "Up to 31" },
            { id: "ca19_9", name: "CA 19.9 (Pancreatic)", unit: "U/mL", range: "Up to 37" },
            { id: "hcal", name: "H. Calcitonin", unit: "pg/mL", range: "Up to 10" }
        ],
        calculations: (v) => {
            if (v.psa_t && v.psa_f) v.psa_ratio = ((v.psa_f / v.psa_t) * 100).toFixed(1);
            return v;
        }
    },

    // ========================================================================
    // 4. INFECTIOUS & VIRAL MARKERS (الفيروسات والمناعة)
    // ========================================================================
    "ViralHepatitis": {
        name: "Viral Hepatitis Profile (الفيروسات)",
        category: "Immunology",
        method: "CLIA / CMIA",
        tat: "Same Day",
        parameters: [
            { id: "hbsag", name: "HBsAg (Virus B)", unit: "Status", range: "Non-Reactive" },
            { id: "hcv_ab", name: "HCV Ab (Virus C)", unit: "Status", range: "Non-Reactive" },
            { id: "hav_total", name: "HAV Ab (Total)", unit: "Status", range: "Non-Reactive" },
            { id: "hav_igm", name: "HAV IgM", unit: "Status", range: "Non-Reactive" },
            { id: "hbc_total", name: "HBc Ab (Total)", unit: "Status", range: "Non-Reactive" },
            { id: "hbc_igm", name: "HBc IgM", unit: "Status", range: "Non-Reactive" }
        ]
    },

    "GeneralImmunology": {
        name: "General Immunology (المناعة العام)",
        category: "Immunology",
        parameters: [
            { id: "crp", name: "CRP (C-Reactive Protein)", unit: "mg/L", range: "Up to 6.0", method: "Turbidimetry" },
            { id: "rf", name: "RF (Rheumatoid Factor)", unit: "IU/mL", range: "Up to 20", method: "Turbidimetry" },
            { id: "aslo", name: "ASLO (Antistreptolysin O)", unit: "IU/mL", range: "Up to 200", method: "Turbidimetry" },
            { id: "ana", name: "ANA (Antinuclear Ab)", unit: "Status", range: "Negative", method: "IFA / ELISA" }
        ]
    },

    // ========================================================================
    // 5. PARASITOLOGY & MICROBIOLOGY (الطفيليات والمزارع)
    // ========================================================================
    "UrineAnalysisFull": {
        name: "Urine Analysis Complete (بول كامل)",
        category: "Parasitology",
        sampleType: "Urine (Midstream)",
        parameters: [
            { id: "u_color", name: "Color", unit: "-", range: "Pale Yellow" },
            { id: "u_ph", name: "pH", unit: "-", range: "5.0 - 8.0" },
            { id: "u_sg", name: "Specific Gravity", unit: "-", range: "1.005 - 1.030" },
            { id: "u_alb", name: "Albumin", unit: "-", range: "Nil" },
            { id: "u_sug", name: "Sugar", unit: "-", range: "Nil" },
            { id: "u_ace", name: "Acetone", unit: "-", range: "Nil" },
            { id: "u_pus", name: "Pus Cells", unit: "/HPF", range: "0 - 5" },
            { id: "u_rbcs", name: "RBCs", unit: "/HPF", range: "0 - 2" },
            { id: "u_epi", name: "Epithelial Cells", unit: "-", range: "Few / Nil" },
            { id: "u_para", name: "Parasites", unit: "-", range: "Nil (e.g. Schistosoma)" },
            { id: "u_amorp", name: "Amorphous", unit: "-", range: "Nil" },
            { id: "u_cryst", name: "Crystals", unit: "-", range: "Nil" },
            { id: "u_cast", name: "Casts", unit: "-", range: "Nil" }
        ]
    },

    "BodyFluids": {
        name: "Body Fluid Analysis (تحليل سوائل الجسم)",
        category: "Special Tests",
        parameters: [
            { id: "fluid_wbc", name: "WBCs", unit: "/uL", range: "-" },
            { id: "fluid_rbc", name: "RBCs", unit: "/uL", range: "-" },
            { id: "fluid_pro", name: "Protein", unit: "g/dL", range: "-" },
            { id: "fluid_glu", name: "Glucose", unit: "mg/dL", range: "-" }
        ]
    },
    "AutoimmuneProfile": {
        name: "Autoimmune & Research (المناعة الذاتية)",
        category: "Immunology",
        parameters: [
            { id: "dsdna", name: "Anti-dsDNA", unit: "IU/mL", range: "Negative < 20 / Borderline: 20-30" },
            { id: "anti_ccp", name: "Anti-CCP (Rheumatoid)", unit: "U/mL", range: "Negative < 5.0" },
            { id: "ana_16", name: "ANA Profile (16 Markers)", unit: "Status", range: "Negative" },
            { id: "anca_p", name: "P-ANCA", unit: "Status", range: "Negative" },
            { id: "anca_c", name: "C-ANCA", unit: "Status", range: "Negative" }
        ]
    },
    "SpecialProteins": {
        name: "Specific Proteins (البروتينات الخاصة)",
        category: "Immunology",
        parameters: [
            { id: "c3", name: "Complement C3", unit: "mg/dL", range: "90 - 180" },
            { id: "c4", name: "Complement C4", unit: "mg/dL", range: "10 - 40" },
            { id: "iga", name: "IgA", unit: "mg/dL", range: "70 - 400" },
            { id: "igg", name: "IgG", unit: "mg/dL", range: "700 - 1600" },
            { id: "igm", name: "IgM", unit: "mg/dL", range: "40 - 230" }
        ]
    },
    "Toxicology": {
        name: "Drugs of Abuse (تحليل المخدرات)",
        category: "Toxicology",
        sampleType: "Urine",
        parameters: [
            { id: "drug_10", name: "Abuse Screen (10 Parameters)", unit: "Status", range: "Negative" },
            { id: "thc", name: "THC (Hashish)", unit: "Status", range: "Negative" },
            { id: "tram", name: "Tramadol", unit: "Status", range: "Negative" }
        ]
    },
    "Histopathology": {
        name: "Pathology & Biopsy (الأنسجة والعينات)",
        category: "Surgical Pathology",
        parameters: [
            { id: "patho_desc", name: "Gross Description", unit: "-", range: "N/A" },
            { id: "patho_diag", name: "Pathological Diagnosis", unit: "-", range: "N/A" }
        ]
    },

    "StoolAnalysisFull": {
        name: "Stool Analysis Complete (براز كامل)",
        category: "Parasitology",
        sampleType: "Fresh Stool",
        parameters: [
            { id: "s_color", name: "Color", unit: "-", range: "Brown" },
            { id: "s_cons", name: "Consistency", unit: "-", range: "Formed" },
            { id: "s_mucus", name: "Mucus", unit: "-", range: "Nil" },
            { id: "s_blood", name: "Blood", unit: "-", range: "Nil" },
            { id: "s_para", name: "Parasites (Protozoa/Helminths)", unit: "-", range: "Not Found" },
            { id: "s_blast", name: "Blastocystis hominis", unit: "-", range: "Not Found" },
            { id: "s_ent", name: "Entamoeba histolytica", unit: "-", range: "Not Found" },
            { id: "s_crypt", name: "Cryptosporidium Spp", unit: "-", range: "Not Found" },
            { id: "s_pus", name: "Pus Cells", unit: "/HPF", range: "0 - 2" },
            { id: "s_rbcs", name: "RBCs", unit: "/HPF", range: "0 - 2" },
            { id: "s_undig", name: "Undigested Food", unit: "-", range: "Nil" }
        ]
    },

    "SemenAnalysisFull": {
        name: "Semen Analysis WHO 2021 (سائل منوي)",
        category: "Specialized",
        preparation: "3 - 5 days sexual abstinence",
        tat: "Same Day",
        parameters: [
            { id: "sm_vol", name: "Volume", unit: "ml", range: "> 1.5" },
            { id: "sm_ph", name: "pH", unit: "-", range: "7.2 - 8.0" },
            { id: "sm_liq", name: "Liquefaction Time", unit: "min", range: "Up to 30 min" },
            { id: "sm_visc", name: "Viscosity", unit: "-", range: "Normal" },
            { id: "sm_count", name: "Sperm Concentration", unit: "mil/ml", range: "> 15" },
            { id: "sm_total", name: "Total Sperm Count", unit: "mil/ejac", calculated: true, range: "> 39" },
            { id: "sm_mot_t", name: "Total Motility (PR+NP)", unit: "%", range: "> 40" },
            { id: "sm_mot_pr", name: "Progressive Motility (PR)", unit: "%", range: "> 32" },
            { id: "sm_norm", name: "Normal Forms", unit: "%", range: "> 4" },
            { id: "sm_agg", name: "Agglutination", unit: "-", range: "Nil" }
        ],
        calculations: (v) => {
            if (v.sm_vol && v.sm_count) v.sm_total = (v.sm_vol * v.sm_count).toFixed(1);
            return v;
        }
    },

    "CultureGeneral": {
        name: "Culture & Sensitivity (مزرعة ميكروبيولوجي)",
        category: "Microbiology",
        tat: "48 - 72 Hours",
        parameters: [
            { id: "c_site", name: "Culture Site", unit: "-", range: "Urine/Blood/Wound" },
            { id: "c_growth", name: "Growth Status", unit: "-", range: "No growth after 48h" },
            { id: "c_isol", name: "Isolated Organism", unit: "-", range: "-" },
            { id: "c_count", name: "Colony Count", unit: "CFU/ml", range: "-" },
            { id: "c_antib", name: "Antibiotic Sensitivity List", unit: "-", range: "Sensitive / Resistant" }
        ]
    },

    // ========================================================================
    // 6. VITAMINS & MINERALS (الفيتامينات والأملاح)
    // ========================================================================
    "VitaminProfile": {
        name: "Vitamins Profile (الفيتامينات)",
        category: "Specialized",
        parameters: [
            { id: "vit_d", name: "Vitamin D (25-OH)", unit: "ng/mL", range: "Deficiency: <20 / Optimal: 30-100", method: "CLIA" },
            { id: "vit_b12", name: "Vitamin B12", unit: "pg/mL", range: "197 - 771", method: "CLIA" },
            { id: "folic", name: "Folic Acid / Folate", unit: "ng/mL", range: "4.6 - 18.7" }
        ]
    },

    "MineralsProfile": {
        name: "Minerals & Bone Profile (العظام)",
        category: "Chemistry",
        parameters: [
            { id: "ca_t", name: "Calcium (Total)", unit: "mg/dL", range: "8.6 - 10.2" },
            { id: "ca_i", name: "Calcium (Ionized)", unit: "mmol/L", range: "1.13 - 1.32" },
            { id: "phos", name: "Phosphorus (Inorganic)", unit: "mg/dL", range: "2.5 - 4.5" },
            { id: "mg", name: "Magnesium", unit: "mg/dL", range: "1.6 - 2.6" },
            { id: "pth", name: "PTH (Parathyroid Hormone)", unit: "pg/mL", range: "15 - 65" }
        ]
    }
};

/**
 * Global Helpers for Data Management
 */

function getReferenceRange(param, patientData) {
    if (!param.range) return "Review Clinical History";
    if (typeof param.range === 'string') return param.range;

    const age = parseInt(patientData.ageY) || 30;
    const gender = (patientData.gender || 'Male').toLowerCase();
    const isPregnant = patientData.isPregnant === 'Yes';

    if (isPregnant && param.range.pregnant) return param.range.pregnant;
    if (age < 12 && param.range.child) return param.range.child;
    if (param.range[gender]) return param.range[gender];

    return param.range.male || param.range.female || "N/A";
}

function getTubeGrouping(selectedTestIds) {
    const groups = {};
    selectedTestIds.forEach(id => {
        const test = medicalTests[id];
        if (test && test.sampleType && test.tubeCap) {
            const key = `${test.sampleType}_${test.tubeCap}`;
            if (!groups[key]) {
                groups[key] = {
                    sampleType: test.sampleType,
                    tubeCap: test.tubeCap,
                    tests: []
                };
            }
            groups[key].tests.push(test.name);
        }
    });
    return groups;
}
