"""
CropSentinel — Root-Cause Diagnostic Reasoning Service.
Investigates competing explanations for observed foliar/crop symptoms:
  - Fungal Pathogens (Alternaria, Cercospora, Powdery Mildew, Rust)
  - Bacterial Pathogens (Xanthomonas, Pseudomonas)
  - Viral Vectors & Sucking Pest Damage (Begomovirus, Mites, Thrips)
  - Macronutrient & Micronutrient Deficiencies (Nitrogen, Iron, Potassium)
  - Physiological Stress (Drought Stoma Closure, Root-Zone Anoxia/Waterlogging, Sunscald)

Generates ranked hypotheses with supporting & contradicting evidence,
targeted diagnostic follow-up questions, and explicit uncertainty handling.
"""
from typing import List, Dict, Any
from app.schemas import (
    DiagnosticEvaluateRequest,
    DiagnosticEvaluateResponse,
    DiagnosticHypothesisItem,
    DiagnosticFollowUpQuestion,
)


def evaluate_root_cause_diagnostics(payload: DiagnosticEvaluateRequest) -> DiagnosticEvaluateResponse:
    crop = payload.crop_name
    stage = payload.growth_stage
    sym = (payload.visible_symptoms or "").lower()
    dist = payload.distribution_pattern.lower()
    rain_hist = payload.recent_rainfall_or_irrigation.lower()
    color_pat = payload.foliar_color_pattern.lower()
    answers = payload.answered_questions or {}

    hypotheses: List[DiagnosticHypothesisItem] = []

    # Answers to prior questions
    leaf_tier = answers.get("leaf_tier", "").lower()
    halo_type = answers.get("halo_type", "").lower()
    onset_speed = answers.get("onset_speed", "").lower()

    # ─── HYPOTHESIS 1: Foliar Fungal Pathogen ──────────────────────────────────────
    fungal_support = []
    fungal_contradict = []
    fungal_score = 50

    if any(k in sym for k in ["spot", "blight", "rust", "lesion", "ring", "mold", "mildew"]):
        fungal_support.append(f"Physical symptom descriptors indicate localized foliar lesions: '{sym[:50]}'")
        fungal_score += 25
    if dist in ["focal_patches", "lower_canopy_only"] or leaf_tier == "lower_older":
        fungal_support.append("Pattern begins in lower/inner canopy where humidity lingers and air circulation is lowest")
        fungal_score += 15
    if rain_hist in ["heavy_rain", "waterlogged"]:
        fungal_support.append("Recent moisture/wet conditions provide necessary free water on leaves for spore germination")
        fungal_score += 10
    if dist == "uniform_whole_field" and not any(k in sym for k in ["blight", "rust"]):
        fungal_contradict.append("Uniform instantaneous field-wide onset is rare for initial fungal colonization")
        fungal_score -= 20
    if rain_hist == "prolonged_drought" and not any(k in sym for k in ["mildew"]):
        fungal_contradict.append("Most foliar fungi (except powdery mildew) require high humidity or free leaf moisture")
        fungal_score -= 15

    hypotheses.append(
        DiagnosticHypothesisItem(
            cause_name=f"Foliar Fungal Complex ({crop} Target/Blight Group)",
            cause_category="fungal_pathogen",
            probability_rank=1,
            confidence_level="high_suspicion" if fungal_score >= 70 else ("moderate_suspicion" if fungal_score >= 45 else "unlikely"),
            supporting_evidence=fungal_support or ["General lesion indicators noted"],
            contradicting_evidence=fungal_contradict or ["No direct disqualifying contradictions found"],
            missing_critical_data=["Microscopic spore identification", "Leaf wetness duration log (hours >= 90% RH)"],
            suggested_field_verification="Inspect leaf undersides using 10x hand lens for dark fungal sporulation or concentric 'target-board' rings.",
            safer_agronomic_step="Prune severely blighted bottom leaves, avoid evening sprinkler irrigation, and isolate the patch.",
        )
    )

    # ─── HYPOTHESIS 2: Nutrient Deficiency (Nitrogen or Micronutrient) ───────────────
    nutr_support = []
    nutr_contradict = []
    nutr_score = 45

    if any(k in sym for k in ["yellow", "pale", "chlorosis", "stunt", "vein"]):
        nutr_support.append(f"Visual symptom notes report foliar chlorosis/yellowing: '{sym[:50]}'")
        nutr_score += 25
    if dist == "uniform_whole_field":
        nutr_support.append("Uniform generalized yellowing across entire plots strongly indicates soil substrate nutrient depletion")
        nutr_score += 20
    if leaf_tier == "lower_older":
        nutr_support.append("Chlorosis strictly on older lower leaves indicates mobile nutrient deficiency (Nitrogen or Potassium translocation)")
        nutr_score += 15
    elif leaf_tier == "upper_young":
        nutr_support.append("Interveinal chlorosis on youngest emerging leaves indicates immobile micronutrient lockout (Iron, Zinc, or Manganese)")
        nutr_score += 15

    if any(k in sym for k in ["wet rot", "ooze", "concentric ring"]):
        nutr_contradict.append("Tissue necrotic decay or concentric fungal rings cannot be caused solely by nutrient deficiency")
        nutr_score -= 30

    hypotheses.append(
        DiagnosticHypothesisItem(
            cause_name="Substrate Nutrient Deficiency or Chemical Lockout (N / Fe / Zn)",
            cause_category="nutrient_deficiency",
            probability_rank=2,
            confidence_level="high_suspicion" if nutr_score >= 70 else ("moderate_suspicion" if nutr_score >= 45 else "unlikely"),
            supporting_evidence=nutr_support or ["Foliar yellowing noted"],
            contradicting_evidence=nutr_contradict or ["No conflicting pathogen lesions observed"],
            missing_critical_data=["Soil Health Card EC and pH test", "Recent synthetic or organic fertilizer application records"],
            suggested_field_verification="Check whether chlorosis is confined to older lower foliage (Nitrogen) or interveinal spaces of newest tips (Iron/Zinc).",
            safer_agronomic_step="Apply small test plot foliar spray of chelated micronutrient or well-rotted vermicompost tea before broad chemical use.",
        )
    )

    # ─── HYPOTHESIS 3: Root-Zone Water Stress or Hypoxia ─────────────────────────────
    water_support = []
    water_contradict = []
    water_score = 40

    if rain_hist == "prolonged_drought":
        water_support.append("Prolonged absence of moisture induces stomatal closure, leaf curling, and tip burn")
        water_score += 30
    elif rain_hist in ["waterlogged", "heavy_rain"]:
        water_support.append("Recent heavy saturation leads to root oxygen starvation (hypoxia), resulting in sudden lower leaf wilting despite wet soil")
        water_score += 30

    if any(k in sym for k in ["wilt", "droop", "curl", "dry"]):
        water_support.append("Wilting and leaf rolling are hallmark physical manifestations of vascular moisture regulation failure")
        water_score += 20

    if dist == "focal_patches" and rain_hist != "waterlogged":
        water_contradict.append("Drought stress typically affects the entire unshaded field rather than discrete isolated focus plants")
        water_score -= 15

    hypotheses.append(
        DiagnosticHypothesisItem(
            cause_name="Root-Zone Moisture Dysregulation (Drought Deficit or Anoxic Waterlogging)",
            cause_category="water_stress",
            probability_rank=3,
            confidence_level="high_suspicion" if water_score >= 65 else ("moderate_suspicion" if water_score >= 40 else "unlikely"),
            supporting_evidence=water_support or ["Moisture context factored"],
            contradicting_evidence=water_contradict or ["No definitive disqualifiers"],
            missing_critical_data=["Tensiometer or electronic root-zone soil moisture %", "Drainage slope assessment"],
            suggested_field_verification="Dig 15 cm into root zone; evaluate soil cohesion by hand. Check for dark, foul-smelling root tips (indicative of waterlogged rot).",
            safer_agronomic_step="If waterlogged, open furrow drainage channels immediately; if parched, apply split irrigation early in the morning.",
        )
    )

    # ─── HYPOTHESIS 4: Viral Vector or Sucking Pest Damage ───────────────────────────
    pest_support = []
    pest_contradict = []
    pest_score = 35

    if any(k in sym for k in ["curl", "mosaic", "pucker", "crinkle", "stunt", "mottle"]):
        pest_support.append(f"Leaf curling or mosaic patterns noted: '{sym[:50]}'")
        pest_score += 30
    if dist in ["focal_patches", "edge_plants"]:
        pest_support.append("Sucking vectors (whiteflies/thrips/aphids) typically enter from field borders or weeds in focal clusters")
        pest_score += 15

    hypotheses.append(
        DiagnosticHypothesisItem(
            cause_name="Viral Vector Inoculation or Sucking Pest Injury (Whitefly / Mite Complex)",
            cause_category="viral_vector",
            probability_rank=4,
            confidence_level="high_suspicion" if pest_score >= 65 else ("moderate_suspicion" if pest_score >= 40 else "unlikely"),
            supporting_evidence=pest_support or ["Leaf deformation symptoms checked"],
            contradicting_evidence=pest_contradict or ["No direct disqualifiers"],
            missing_critical_data=["Yellow sticky card insect counts", "Presence of honeydew or sooty mold"],
            suggested_field_verification="Tap affected branches over a clean white paper sheet; check with magnifying glass for moving yellow thrips or two-spotted spider mites.",
            safer_agronomic_step="Erect yellow and blue sticky traps (10 per acre); spray organic cold-pressed neem oil (1500 ppm) on leaf undersides.",
        )
    )

    # Sort hypotheses by probability / confidence
    rank_order = {"high_suspicion": 3, "moderate_suspicion": 2, "unlikely": 1}
    hypotheses.sort(key=lambda h: rank_order.get(h.confidence_level, 0), reverse=True)
    for idx, h in enumerate(hypotheses, start=1):
        h.probability_rank = idx

    # Targeted follow-up questions to distinguish top hypotheses
    questions: List[DiagnosticFollowUpQuestion] = []
    if "leaf_tier" not in answers:
        questions.append(
            DiagnosticFollowUpQuestion(
                question_id="leaf_tier",
                question_text="Which leaf layer shows the most pronounced symptoms?",
                options=[
                    "Oldest bottom leaves first (points to Nitrogen/Potassium deficit or soil-borne fungi)",
                    "Newest young tips and tender emerging leaves (points to Iron/Zinc lockout, viral vector, or mites)",
                    "Equally scattered throughout the entire canopy without tier preference",
                ],
                reasoning_purpose="Distinguishes mobile nutrient deficiencies and splash-borne fungi from immobile micronutrient lockouts and insect vector feeding.",
            )
        )

    if "halo_type" not in answers:
        questions.append(
            DiagnosticFollowUpQuestion(
                question_id="halo_type",
                question_text="Do the leaf spots have visible haloes or specific borders?",
                options=[
                    "Spots surrounded by a bright yellow halo (classic fungal or bacterial leaf spot)",
                    "Dry papery brown margins with concentric rings (Alternaria / target spot fungal signature)",
                    "Water-soaked translucent or greasy patches on the leaf underside (bacterial blight signature)",
                    "No distinct spots; generalized yellowing or interveinal striping only",
                ],
                reasoning_purpose="Differentiates fungal necrotic ring structures from bacterial water-soaking and physiological chlorosis.",
            )
        )

    if "onset_speed" not in answers:
        questions.append(
            DiagnosticFollowUpQuestion(
                question_id="onset_speed",
                question_text="How quickly did the condition develop in the field?",
                options=[
                    "Sudden emergence within 24–48 hours following heavy rain or extreme heat",
                    "Gradual progressive worsening over 7–14 days",
                    "Present continuously since early seedling emergence",
                ],
                reasoning_purpose="Identifies acute abiotic weather events (scald, flooding shock) versus biotic biological epidemic reproduction curves.",
            )
        )

    uncertainty = "adequate_preliminary" if len(answers) >= 2 else "high_uncertainty"
    guidance = (
        f"Differential investigation for {crop} ({stage}): Symptom analysis has prioritized "
        f"'{hypotheses[0].cause_name}' as the primary working hypothesis. Because physical symptoms can overlap, "
        "relying solely on a single diagnosis risks expensive and ineffective spray applications."
    )

    safety_note = (
        "AGRONOMIC SAFETY PROTOCOL: CropSentinel never recommends synthetic chemical pesticides without physical "
        "sample verification. Always take 3 representative leaf samples in a sealed plastic bag to your nearest "
        "KVK or government agricultural extension center for definitive microscopic confirmation."
    )

    return DiagnosticEvaluateResponse(
        crop_name=crop,
        growth_stage=stage,
        hypotheses=hypotheses,
        next_follow_up_questions=questions,
        uncertainty_level=uncertainty,
        guidance_note=guidance,
        safety_protocol_note=safety_note,
    )
