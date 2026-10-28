"""
Real AI Crop Disease Classification Service.
- Integrates `linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification` via Hugging Face Inference API.
- Reads HUGGINGFACE_API_KEY securely from `backend/.env` (never exposed to frontend or logs).
- Verifies all 38 PlantVillage classes (both raw `id2label` format `Crop___Condition` and human-readable format)
  and the 14 supported crop groups, including the critical limitation that Soybean, Blueberry, and Raspberry
  only have `healthy` classes in PlantVillage (0 disease classes).
- Checks whether the uploaded crop belongs to a supported crop group and whether the model's prediction
  matches the selected crop with non-ambiguous confidence (>= 0.35). If unsupported, mismatched, ambiguous,
  or if the provider fails, reports `analysis_status = "unavailable"` rather than inventing a diagnosis.
- Clearly labels the returned score as uncalibrated model confidence (not a calibrated probability of disease)
  and displays an explicit PlantVillage studio-vs-field limitation notice.
"""
import io
import logging
from typing import Dict, Any, List, Optional, Tuple
import httpx
from PIL import Image, UnidentifiedImageError
from app.config import settings

logger = logging.getLogger(__name__)

CONFIDENCE_CALIBRATION_NOTE = (
    "MODEL CONFIDENCE NOTE: The reported score is an uncalibrated neural network softmax score "
    "across the model's 38 PlantVillage classes—it is NOT a scientifically or medically calibrated "
    "probability of disease."
)

PLANTVILLAGE_LIMITATION_NOTICE = (
    "PLANTVILLAGE DATASET LIMITATION: This model (linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification) "
    "was trained on controlled PlantVillage studio photographs of single detached leaves on uniform backgrounds. "
    "Real-world field images with complex backgrounds, variable sunlight, multiple leaves, or mixed stresses "
    "can cause misclassifications. Never treat this output as standalone proof of field disease."
)

PRELIMINARY_DISCLAIMER = (
    f"{PLANTVILLAGE_LIMITATION_NOTICE} {CONFIDENCE_CALIBRATION_NOTE} "
    "Always verify suspected symptoms in the field with a qualified agronomist or local KVK officer "
    "before applying any chemical treatment."
)

# Exact 38 classes from `linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification` config.json (id2label 0..37)
# mapped to (canonical_crop_group, human_readable_label, is_healthy)
VERIFIED_ID2LABEL_MAP: Dict[str, Tuple[str, str, bool]] = {
    "Apple___Apple_scab": ("Apple", "Apple — Apple Scab", False),
    "Apple___Black_rot": ("Apple", "Apple — Black Rot", False),
    "Apple___Cedar_apple_rust": ("Apple", "Apple — Cedar Apple Rust", False),
    "Apple___healthy": ("Apple", "Apple — Healthy", True),
    "Blueberry___healthy": ("Blueberry", "Blueberry — Healthy", True),
    "Cherry_(including_sour)___Powdery_mildew": ("Cherry", "Cherry — Powdery Mildew", False),
    "Cherry_(including_sour)___healthy": ("Cherry", "Cherry — Healthy", True),
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": ("Corn (Maize)", "Corn (Maize) — Cercospora / Gray Leaf Spot", False),
    "Corn_(maize)___Common_rust_": ("Corn (Maize)", "Corn (Maize) — Common Rust", False),
    "Corn_(maize)___Northern_Leaf_Blight": ("Corn (Maize)", "Corn (Maize) — Northern Leaf Blight", False),
    "Corn_(maize)___healthy": ("Corn (Maize)", "Corn (Maize) — Healthy", True),
    "Grape___Black_rot": ("Grape", "Grape — Black Rot", False),
    "Grape___Esca_(Black_Measles)": ("Grape", "Grape — Esca (Black Measles)", False),
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": ("Grape", "Grape — Leaf Blight (Isariopsis Leaf Spot)", False),
    "Grape___healthy": ("Grape", "Grape — Healthy", True),
    "Orange___Haunglongbing_(Citrus_greening)": ("Orange / Citrus", "Orange / Citrus — Huanglongbing (Citrus Greening)", False),
    "Peach___Bacterial_spot": ("Peach", "Peach — Bacterial Spot", False),
    "Peach___healthy": ("Peach", "Peach — Healthy", True),
    "Pepper,_bell___Bacterial_spot": ("Bell Pepper / Chilli", "Bell Pepper — Bacterial Spot", False),
    "Pepper,_bell___healthy": ("Bell Pepper / Chilli", "Bell Pepper — Healthy", True),
    "Potato___Early_blight": ("Potato", "Potato — Early Blight", False),
    "Potato___Late_blight": ("Potato", "Potato — Late Blight", False),
    "Potato___healthy": ("Potato", "Potato — Healthy", True),
    "Raspberry___healthy": ("Raspberry", "Raspberry — Healthy", True),
    "Soybean___healthy": ("Soybean", "Soybean — Healthy", True),
    "Squash___Powdery_mildew": ("Squash / Cucurbit", "Squash — Powdery Mildew", False),
    "Strawberry___Leaf_scorch": ("Strawberry", "Strawberry — Leaf Scorch", False),
    "Strawberry___healthy": ("Strawberry", "Strawberry — Healthy", True),
    "Tomato___Bacterial_spot": ("Tomato", "Tomato — Bacterial Spot", False),
    "Tomato___Early_blight": ("Tomato", "Tomato — Early Blight", False),
    "Tomato___Late_blight": ("Tomato", "Tomato — Late Blight", False),
    "Tomato___Leaf_Mold": ("Tomato", "Tomato — Leaf Mold", False),
    "Tomato___Septoria_leaf_spot": ("Tomato", "Tomato — Septoria Leaf Spot", False),
    "Tomato___Spider_mites Two-spotted_spider_mite": ("Tomato", "Tomato — Two-Spotted Spider Mite", False),
    "Tomato___Target_Spot": ("Tomato", "Tomato — Target Spot", False),
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": ("Tomato", "Tomato — Yellow Leaf Curl Virus", False),
    "Tomato___Tomato_mosaic_virus": ("Tomato", "Tomato — Mosaic Virus", False),
    "Tomato___healthy": ("Tomato", "Tomato — Healthy", True),
}

# Human-readable label aliases also emitted by some Hugging Face inference pipelines for this model
HUMAN_LABEL_ALIASES: Dict[str, Tuple[str, str, bool]] = {
    "apple scab": ("Apple", "Apple — Apple Scab", False),
    "apple with black rot": ("Apple", "Apple — Black Rot", False),
    "cedar apple rust": ("Apple", "Apple — Cedar Apple Rust", False),
    "healthy apple": ("Apple", "Apple — Healthy", True),
    "healthy blueberry plant": ("Blueberry", "Blueberry — Healthy", True),
    "cherry with powdery mildew": ("Cherry", "Cherry — Powdery Mildew", False),
    "healthy cherry plant": ("Cherry", "Cherry — Healthy", True),
    "corn (maize) with cercospora and gray leaf spot": ("Corn (Maize)", "Corn (Maize) — Cercospora / Gray Leaf Spot", False),
    "corn (maize) with common rust": ("Corn (Maize)", "Corn (Maize) — Common Rust", False),
    "corn (maize) with northern leaf blight": ("Corn (Maize)", "Corn (Maize) — Northern Leaf Blight", False),
    "healthy corn (maize) plant": ("Corn (Maize)", "Corn (Maize) — Healthy", True),
    "grape with black rot": ("Grape", "Grape — Black Rot", False),
    "grape with esca (black measles)": ("Grape", "Grape — Esca (Black Measles)", False),
    "grape with isariopsis leaf spot": ("Grape", "Grape — Leaf Blight (Isariopsis Leaf Spot)", False),
    "healthy grape plant": ("Grape", "Grape — Healthy", True),
    "orange with citrus greening": ("Orange / Citrus", "Orange / Citrus — Huanglongbing (Citrus Greening)", False),
    "peach with bacterial spot": ("Peach", "Peach — Bacterial Spot", False),
    "healthy peach plant": ("Peach", "Peach — Healthy", True),
    "bell pepper with bacterial spot": ("Bell Pepper / Chilli", "Bell Pepper — Bacterial Spot", False),
    "healthy bell pepper plant": ("Bell Pepper / Chilli", "Bell Pepper — Healthy", True),
    "potato with early blight": ("Potato", "Potato — Early Blight", False),
    "potato with late blight": ("Potato", "Potato — Late Blight", False),
    "healthy potato plant": ("Potato", "Potato — Healthy", True),
    "healthy raspberry plant": ("Raspberry", "Raspberry — Healthy", True),
    "healthy soybean plant": ("Soybean", "Soybean — Healthy", True),
    "squash with powdery mildew": ("Squash / Cucurbit", "Squash — Powdery Mildew", False),
    "strawberry with leaf scorch": ("Strawberry", "Strawberry — Leaf Scorch", False),
    "healthy strawberry plant": ("Strawberry", "Strawberry — Healthy", True),
    "tomato with bacterial spot": ("Tomato", "Tomato — Bacterial Spot", False),
    "tomato with early blight": ("Tomato", "Tomato — Early Blight", False),
    "tomato with late blight": ("Tomato", "Tomato — Late Blight", False),
    "tomato with leaf mold": ("Tomato", "Tomato — Leaf Mold", False),
    "tomato with septoria leaf spot": ("Tomato", "Tomato — Septoria Leaf Spot", False),
    "tomato with spider mites or two-spotted spider mite": ("Tomato", "Tomato — Two-Spotted Spider Mite", False),
    "tomato with target spot": ("Tomato", "Tomato — Target Spot", False),
    "tomato yellow leaf curl virus": ("Tomato", "Tomato — Yellow Leaf Curl Virus", False),
    "tomato mosaic virus": ("Tomato", "Tomato — Mosaic Virus", False),
    "healthy tomato plant": ("Tomato", "Tomato — Healthy", True),
}

# Crops in PlantVillage that ONLY have a 'healthy' class and 0 disease classes
HEALTHY_ONLY_PLANTVILLAGE_CROPS = {"Soybean", "Blueberry", "Raspberry"}

# Minimum softmax score required to report a preliminary diagnosis (below this is treated as ambiguous)
MIN_RELIABLE_CONFIDENCE = 0.35

_DIRECTLY_SUPPORTED_CROP_KEYWORDS: Dict[str, str] = {
    "tomato": "Tomato",
    "potato": "Potato",
    "maize": "Corn (Maize)",
    "corn": "Corn (Maize)",
    "sweet corn": "Corn (Maize)",
    "baby corn": "Corn (Maize)",
    "apple": "Apple",
    "grape": "Grape",
    "grapes": "Grape",
    "chilli": "Bell Pepper / Chilli",
    "bell pepper": "Bell Pepper / Chilli",
    "capsicum": "Bell Pepper / Chilli",
    "pepper": "Bell Pepper / Chilli",
    "peach": "Peach",
    "orange": "Orange / Citrus",
    "citrus": "Orange / Citrus",
    "mandarin": "Orange / Citrus",
    "sweet lime": "Orange / Citrus",
    "mosambi": "Orange / Citrus",
    "strawberry": "Strawberry",
    "cherry": "Cherry",
    "soybean": "Soybean",
    "squash": "Squash / Cucurbit",
    "pumpkin": "Squash / Cucurbit",
    "zucchini": "Squash / Cucurbit",
    "blueberry": "Blueberry",
    "raspberry": "Raspberry",
}

PLANT_DISEASE_MODEL_SPEC: Dict[str, Any] = {
    "model_id": "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification",
    "architecture": "MobileNetV2 (224x224 RGB image-classification pipeline fine-tuned on PlantVillage 38-class dataset)",
    "inference_task": "image-classification",
    "input_requirements": "RGB leaf photograph (JPEG, PNG, or WEBP up to 10 MB; normalized to 224x224 RGB for MobileNetV2)",
    "expected_response_format": '[{"label": "Tomato___Early_blight", "score": 0.9142}, ...]',
    "supported_crops": [
        "Tomato (10 classes: 9 diseases + healthy)",
        "Potato (3 classes: Early Blight, Late Blight, healthy)",
        "Corn (Maize) (4 classes: Cercospora/Gray Leaf Spot, Common Rust, Northern Leaf Blight, healthy)",
        "Apple (4 classes: Apple Scab, Black Rot, Cedar Apple Rust, healthy)",
        "Grape (4 classes: Black Rot, Esca, Isariopsis Leaf Spot, healthy)",
        "Bell Pepper / Chilli (2 classes: Bacterial Spot, healthy)",
        "Peach (2 classes: Bacterial Spot, healthy)",
        "Orange / Citrus (1 class: Huanglongbing / Citrus Greening)",
        "Strawberry (2 classes: Leaf Scorch, healthy)",
        "Cherry (2 classes: Powdery Mildew, healthy)",
        "Squash / Cucurbit (1 class: Powdery Mildew)",
        "Soybean (1 class: healthy only — 0 disease classes in PlantVillage)",
        "Blueberry (1 class: healthy only — 0 disease classes in PlantVillage)",
        "Raspberry (1 class: healthy only — 0 disease classes in PlantVillage)",
    ],
    "supported_crop_names": [
        "Tomato",
        "Potato",
        "Corn (Maize)",
        "Apple",
        "Grape",
        "Bell Pepper / Chilli",
        "Peach",
        "Orange / Citrus",
        "Strawberry",
        "Cherry",
        "Squash / Cucurbit",
        "Soybean",
        "Blueberry",
        "Raspberry",
    ],
    "unsupported_major_crops_note": (
        "Crops such as Wheat, Rice/Paddy, Cotton, Sugarcane, Mustard, Chickpea, and Millets have 0 classes "
        "in the 38-class PlantVillage dataset. When these crops are selected, CropSentinel honestly reports "
        "that AI leaf classification is unavailable for that crop rather than inventing a mismatched diagnosis."
    ),
    "supported_classes": list(VERIFIED_ID2LABEL_MAP.keys()),
    "confidence_calibration_note": CONFIDENCE_CALIBRATION_NOTE,
    "plantvillage_limitation_notice": PLANTVILLAGE_LIMITATION_NOTICE,
}

# Rule-based reference library for post-classification agronomic checks (clearly labeled as rule-based)
CONDITION_GUIDANCE: Dict[str, Dict[str, Any]] = {
    "healthy": {
        "severity": "none",
        "symptoms": ["Uniform green lamina without obvious necrotic lesions or chlorotic halos"],
        "next_steps": [
            "[Rule-Based] Continue scheduled field scouting every 5–7 days.",
            "[Rule-Based] Maintain balanced irrigation and monitor lower canopy humidity.",
        ],
        "preventive": [
            "Keep field borders clear of volunteer host weeds.",
            "Record baseline leaf appearance in Crop Memory for seasonal comparison.",
        ],
        "expert_needed": False,
    },
    "blight": {
        "severity": "moderate",
        "symptoms": [
            "Model class is associated with water-soaked or concentric necrotic lesions on foliage",
        ],
        "next_steps": [
            "[Rule-Based] Inspect 10–15 plants across multiple field zones to determine lesion spread.",
            "[Rule-Based] Check lower leaves and stems for dark lesions or sporulation under humid conditions.",
            "[Rule-Based] Avoid overhead irrigation late in the day to reduce leaf wetness duration.",
            "[Rule-Based] Consult a certified local agronomist with physical leaf samples before chemical intervention.",
        ],
        "preventive": [
            "Improve canopy airflow through appropriate plant spacing and pruning of heavily affected debris.",
            "Practice crop rotation with non-host crops in subsequent seasons.",
        ],
        "expert_needed": True,
    },
    "rust": {
        "severity": "moderate",
        "symptoms": [
            "Model class is associated with small rust-colored, orange, or brown pustules on leaf surfaces",
        ],
        "next_steps": [
            "[Rule-Based] Rub suspected pustules gently with a clean tissue to check for rusty spore transfer.",
            "[Rule-Based] Assess upper vs. flag leaf involvement to gauge potential photosynthetic impact.",
            "[Rule-Based] Seek local extension advice on whether crop growth stage warrants intervention.",
        ],
        "preventive": [
            "Select rust-tolerant cultivars in future plantings.",
            "Avoid excessive nitrogen applications that promote dense, succulent canopy growth.",
        ],
        "expert_needed": True,
    },
    "mildew": {
        "severity": "mild",
        "symptoms": [
            "Model class is associated with powdery white/grayish patches or angular yellow-green blotches",
        ],
        "next_steps": [
            "[Rule-Based] Examine both upper and lower leaf surfaces with a hand lens.",
            "[Rule-Based] Monitor relative humidity and night-time dew periods.",
            "[Rule-Based] Consult an agricultural advisor for crop-specific integrated pest management options.",
        ],
        "preventive": [
            "Ensure adequate sunlight penetration and air circulation.",
            "Remove severely affected plant debris after harvest.",
        ],
        "expert_needed": True,
    },
    "spot": {
        "severity": "mild",
        "symptoms": [
            "Model class is associated with discrete circular or angular spots on foliage",
        ],
        "next_steps": [
            "[Rule-Based] Check whether spots have yellow halos, concentric rings, or tiny dark fruiting bodies.",
            "[Rule-Based] Compare young upper leaves against older lower leaves to track progression.",
            "[Rule-Based] Verify with a local plant clinic whether the cause is fungal, bacterial, or physiological.",
        ],
        "preventive": [
            "Minimize splash dispersal by avoiding high-pressure overhead watering.",
            "Sanitize pruning and field tools between plots.",
        ],
        "expert_needed": True,
    },
    "rot": {
        "severity": "moderate",
        "symptoms": [
            "Model class is associated with dark brown/black expanding necrotic rot lesions on leaves or fruit",
        ],
        "next_steps": [
            "[Rule-Based] Inspect surrounding foliage and fruit clusters for dark sunken lesions or mummified tissue.",
            "[Rule-Based] Prune and remove infected plant debris away from the field to reduce inoculum.",
            "[Rule-Based] Confirm diagnosis with a local KVK or horticulture specialist before treatment.",
        ],
        "preventive": [
            "Ensure proper canopy ventilation and avoid prolonged leaf wetness.",
            "Remove overwintering mummified fruit or crop residue after harvest.",
        ],
        "expert_needed": True,
    },
    "virus": {
        "severity": "moderate",
        "symptoms": [
            "Model class is associated with systemic leaf curling, mosaic mottling, yellowing, or stunted growth",
        ],
        "next_steps": [
            "[Rule-Based] Inspect leaf undersides for sucking insect vectors such as whiteflies, aphids, or thrips.",
            "[Rule-Based] Note that viral infections cannot be cured with fungicides; focus on vector management and rogueing severely infected plants.",
            "[Rule-Based] Consult a local agricultural extension officer to confirm viral etiology.",
        ],
        "preventive": [
            "Use certified virus-free seed or seedlings and resistant hybrids.",
            "Control weed hosts and monitor insect vectors early in the season.",
        ],
        "expert_needed": True,
    },
}


def get_model_specification() -> Dict[str, Any]:
    spec = dict(PLANT_DISEASE_MODEL_SPEC)
    spec["configured_model_id"] = settings.effective_model_id
    spec["ai_provider"] = settings.ai_provider
    spec["ai_configured"] = bool(settings.effective_hf_key)
    return spec


def resolve_supported_crop_group(crop_type: str) -> Optional[str]:
    """
    Maps a user-supplied crop name (e.g., 'Tomato', 'Maize', 'Bell Pepper / Chilli')
    to one of the 14 canonical PlantVillage crop groups, or None if unsupported.
    """
    c_low = (crop_type or "").strip().lower()
    if not c_low:
        return None
    for kw, canonical in _DIRECTLY_SUPPORTED_CROP_KEYWORDS.items():
        if kw == c_low or kw in c_low:
            return canonical
    return None


def resolve_plantvillage_label(raw_label: str) -> Optional[Tuple[str, str, bool]]:
    """
    Verifies whether `raw_label` is one of the 38 PlantVillage classes (either exact `id2label`
    like `Tomato___Early_blight` or human-readable `Tomato with Early Blight`) or a valid
    plant-pathology class. Returns `(crop_group, display_label, is_healthy)` or `None` if invalid/generic.
    """
    if not raw_label or not isinstance(raw_label, str):
        return None
    s = raw_label.strip()
    if not s:
        return None

    # 1. Exact match in VERIFIED_ID2LABEL_MAP
    if s in VERIFIED_ID2LABEL_MAP:
        return VERIFIED_ID2LABEL_MAP[s]

    # 2. Case-insensitive match in VERIFIED_ID2LABEL_MAP or HUMAN_LABEL_ALIASES
    s_low = s.lower()
    for k, val in VERIFIED_ID2LABEL_MAP.items():
        if k.lower() == s_low:
            return val
    if s_low in HUMAN_LABEL_ALIASES:
        return HUMAN_LABEL_ALIASES[s_low]

    # 3. Normalized separator match (e.g. 'Tomato — Early blight' or 'Tomato_Early_blight')
    norm = s.replace("___", " ").replace("__", " ").replace("_", " ").replace("—", " ").replace("-", " ")
    norm = " ".join(norm.split()).lower()
    for k, val in VERIFIED_ID2LABEL_MAP.items():
        k_norm = k.replace("___", " ").replace("_", " ").replace("-", " ")
        k_norm = " ".join(k_norm.split()).lower()
        if norm == k_norm or norm == val[1].replace("—", " ").replace("-", " ").lower():
            return val
    for alias_k, val in HUMAN_LABEL_ALIASES.items():
        if norm == alias_k:
            return val

    return None


def _is_valid_plant_disease_label(label: str) -> bool:
    return resolve_plantvillage_label(label) is not None


def _lookup_rule_guidance(label: str) -> Dict[str, Any]:
    lower = label.lower()
    if "healthy" in lower:
        return CONDITION_GUIDANCE["healthy"]
    for key in ("blight", "rust", "mildew", "spot", "rot", "virus", "curl", "mosaic", "scab", "scorch", "mite", "greening", "esca"):
        if key in lower:
            if key in ("curl", "mosaic", "greening"):
                mapped_key = "virus"
            elif key in ("scab", "scorch", "mite"):
                mapped_key = "spot"
            elif key == "esca":
                mapped_key = "rot"
            else:
                mapped_key = key
            return CONDITION_GUIDANCE[mapped_key]
    return {
        "severity": "moderate",
        "symptoms": [
            f"Classification matched PlantVillage class '{label}' (whole-leaf image classifier output; bounding boxes not provided)"
        ],
        "next_steps": [
            "[Rule-Based] Inspect surrounding plants in a W-pattern across the field to check incidence.",
            "[Rule-Based] Examine leaf undersides, petioles, and root collar for secondary signs.",
            "[Rule-Based] Submit clear macro photos and physical samples to a local agricultural extension officer.",
        ],
        "preventive": [
            "Avoid working in fields when foliage is wet to limit mechanical spread.",
            "Document affected area coordinates and monitor progression over 72 hours.",
        ],
        "expert_needed": True,
    }


def _prepare_image_bytes(image_bytes: bytes) -> bytes:
    """
    Validates image via Pillow and normalizes to standard RGB JPEG bytes so that
    RGBA PNGs, WEBP images, or unusual color modes are reliably accepted by the
    Hugging Face MobileNetV2 image-classification pipeline.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        rgb = img.convert("RGB")
        if max(rgb.size) > 1024:
            rgb.thumbnail((1024, 1024))
        out = io.BytesIO()
        rgb.save(out, format="JPEG", quality=92)
        return out.getvalue()


async def _post_to_huggingface(model_id: str, api_key: str, payload_bytes: bytes) -> httpx.Response:
    """
    Calls Hugging Face Inference API.
    Tries the current official HF Inference Router (`router.huggingface.co/hf-inference/models/{model_id}`)
    and falls back to `api-inference.huggingface.co/models/{model_id}` if 404/410 is returned.
    Never logs or exposes `api_key`.
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "image/jpeg",
        "Accept": "application/json",
    }
    router_url = f"https://router.huggingface.co/hf-inference/models/{model_id}"
    legacy_url = f"https://api-inference.huggingface.co/models/{model_id}"

    async with httpx.AsyncClient(timeout=28.0, follow_redirects=True) as client:
        resp = await client.post(router_url, content=payload_bytes, headers=headers)
        if resp.status_code in (404, 410):
            resp = await client.post(legacy_url, content=payload_bytes, headers=headers)
        return resp


async def analyze_crop_image(image_bytes: bytes, filename: str, crop_type: str) -> Dict[str, Any]:
    """
    Validates image & crop support, queries the configured Hugging Face Inference API,
    verifies returned labels against the 38 PlantVillage classes and selected crop,
    and never fabricates a diagnosis if unsupported, ambiguous, unconfigured, or failed.
    """
    api_key = settings.effective_hf_key
    model_id = settings.effective_model_id
    provider = settings.ai_provider

    # 1. Validate and normalize image bytes first
    try:
        normalized_bytes = _prepare_image_bytes(image_bytes)
    except (UnidentifiedImageError, Exception):
        return {
            "analysis_status": "error",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Upload a clear, intact JPEG, PNG, or WEBP photograph of a single crop leaf.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": "Uploaded file could not be decoded as a valid RGB image.",
        }

    # 2. Check whether the uploaded crop belongs to the 14 supported PlantVillage crop groups
    expected_crop_group = resolve_supported_crop_group(crop_type)
    if expected_crop_group is None:
        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [
                f"Selected crop '{crop_type}' is outside the 14 PlantVillage crop species supported by '{model_id}'.",
                PLANTVILLAGE_LIMITATION_NOTICE,
            ],
            "severity": "unknown",
            "recommended_next_steps": [
                f"[Rule-Based] '{crop_type}' is not in the 38-class PlantVillage training set; rely on field scouting and local KVK diagnostics.",
                "[Rule-Based] Inspect 10–15 plants across the plot and record visible symptoms in Field Monitor.",
                "[Rule-Based] Review the 182-Crop FAO/ICAR Environmental Suitability & Stress Model on the Crop Details page.",
            ],
            "preventive_measures": [
                "Maintain regular scouting logs and local Open-Meteo weather risk monitoring.",
            ],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": (
                f"Unsupported Crop Class: '{crop_type}' is not among the 14 crop groups supported by "
                f"'{model_id}' (Tomato, Potato, Corn/Maize, Apple, Grape, Bell Pepper/Chilli, Peach, "
                "Orange/Citrus, Strawberry, Cherry, Squash, Soybean, Blueberry, Raspberry). "
                "A reliable AI leaf diagnosis is unavailable for this crop rather than inventing a mismatched class."
            ),
        }

    # 3. Check API key availability
    if not api_key:
        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Record manual field observations and leaf symptoms in Field Monitor.",
                "[Rule-Based] Inspect upper and lower leaf surfaces across multiple field zones.",
                "[Rule-Based] Consult a local agronomist for physical inspection while AI inference is unconfigured.",
            ],
            "preventive_measures": [
                "Maintain regular scouting logs and weather risk monitoring.",
            ],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": (
                "AI analysis unavailable: HF_TOKEN (or legacy HUGGINGFACE_API_KEY) is not configured in backend/.env. "
                "Add a valid Hugging Face token (with 'Make calls to Inference Providers' permission) "
                "to backend/.env and restart the backend to enable live image classification."
            ),
        }

    # 4. Call Hugging Face Inference API
    try:
        resp = await _post_to_huggingface(model_id=model_id, api_key=api_key, payload_bytes=normalized_bytes)
    except httpx.TimeoutException:
        logger.warning("Hugging Face inference timed out for model %s", model_id)
        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Retry image analysis in 30–60 seconds (remote model may be cold-starting).",
                "[Rule-Based] Perform manual field scouting if immediate assessment is required.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": (
                f"Inference Timeout: Request to '{model_id}' timed out. Hugging Face serverless models may take "
                "20–30s to wake up on first request. No fabricated diagnosis was generated."
            ),
        }
    except httpx.HTTPError as exc:
        logger.error("Hugging Face HTTP transport error (%s)", exc.__class__.__name__)
        return {
            "analysis_status": "error",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Check internet connectivity and retry.",
                "[Rule-Based] Continue using manual symptom logging and weather risk assessment.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": f"Network error contacting AI provider ({exc.__class__.__name__}). No diagnosis was fabricated.",
        }

    # 5. Handle non-200 HTTP responses (auth errors, rate limits, cold starts, provider failures)
    if resp.status_code != 200:
        safe_status = resp.status_code
        err_msg = ""
        try:
            err_json = resp.json()
            if isinstance(err_json, dict):
                err_msg = str(err_json.get("error") or err_json.get("message") or "")[:240]
        except Exception:
            err_msg = resp.text[:200]

        if safe_status in (401, 403):
            hint = (
                f"API Authentication Error (HTTP {safe_status}): Hugging Face rejected HF_TOKEN. "
                "Verify that the token in backend/.env is valid and has 'Make calls to Inference Providers' enabled."
            )
        elif safe_status == 503:
            hint = (
                f"Model Loading / Cold Start (HTTP 503): '{model_id}' is warming up on Hugging Face. "
                "Please wait 20–30 seconds and click Analyze Leaf Image again."
            )
        elif safe_status == 429:
            hint = (
                "Rate Limit Exceeded (HTTP 429): Hugging Face Inference API rate limit reached. "
                "Please wait 60 seconds before retrying."
            )
        else:
            hint = f"Provider Error (HTTP {safe_status}) for model '{model_id}'. {err_msg}".strip()

        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Verify HUGGINGFACE_API_KEY permissions and AI_MODEL_ID in backend/.env.",
                "[Rule-Based] Continue using manual symptom logging and weather risk assessment.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": hint,
        }

    # 6. Validate response JSON structure
    try:
        payload = resp.json()
    except ValueError:
        payload = None

    if not isinstance(payload, list) or len(payload) == 0 or not isinstance(payload[0], dict):
        return {
            "analysis_status": "error",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Ensure the configured AI_MODEL_ID returns standard image-classification JSON.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": "Unexpected response format from AI inference provider. No diagnosis was fabricated.",
        }

    # 7. Verify returned labels against the 38 verified PlantVillage classes
    verified_preds: List[Dict[str, Any]] = []
    for item in payload[:5]:
        if not isinstance(item, dict) or "label" not in item or "score" not in item:
            continue
        raw_lbl = str(item.get("label", "")).strip()
        try:
            score = float(item.get("score", -1.0))
        except (TypeError, ValueError):
            continue
        if not (0.0 <= score <= 1.0):
            continue
        resolved = resolve_plantvillage_label(raw_lbl)
        if resolved is None:
            continue
        pred_crop_group, display_lbl, is_healthy = resolved
        verified_preds.append({
            "raw_label": raw_lbl,
            "label": display_lbl,
            "crop_group": pred_crop_group,
            "is_healthy": is_healthy,
            "confidence": round(score, 4),
        })

    if not verified_preds:
        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": [],
            "visual_symptoms": [],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Verify that AI_MODEL_ID in backend/.env is set to 'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification'.",
                "[Rule-Based] Upload a clear close-up photograph of a crop leaf.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": (
                "Unsupported Model Output: The inference response did not contain any verified PlantVillage "
                "38-class labels. Generic non-plant labels are rejected."
            ),
        }

    verified_preds.sort(key=lambda x: x["confidence"], reverse=True)
    raw_preds_out = [{"label": p["label"], "confidence": p["confidence"]} for p in verified_preds]
    top = verified_preds[0]
    top_conf: float = top["confidence"]

    # 8. Check for ambiguous low confidence (< 0.35)
    if top_conf < MIN_RELIABLE_CONFIDENCE:
        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": raw_preds_out,
            "visual_symptoms": [
                f"Top model class '{top['label']}' had low uncalibrated confidence ({round(top_conf * 100, 1)}% < 35%).",
                PLANTVILLAGE_LIMITATION_NOTICE,
            ],
            "severity": "unknown",
            "recommended_next_steps": [
                "[Rule-Based] Retake a closer, well-lit photograph of a single affected leaf against a plain background.",
                "[Rule-Based] Perform physical scouting across 10–15 plants in the field.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": (
                f"Ambiguous Image Signal: Top model confidence ({round(top_conf * 100, 1)}%) is below the "
                "35% reliability threshold. A reliable diagnosis is unavailable for this image."
            ),
        }

    # 9. Check whether the predicted class matches the uploaded crop group
    if top["crop_group"] != expected_crop_group:
        return {
            "analysis_status": "unavailable",
            "predicted_condition": None,
            "model_confidence": None,
            "raw_predictions": raw_preds_out,
            "visual_symptoms": [
                f"Uploaded crop was specified as '{expected_crop_group}', but top model class was '{top['label']}' ({round(top_conf * 100, 1)}%).",
                PLANTVILLAGE_LIMITATION_NOTICE,
            ],
            "severity": "unknown",
            "recommended_next_steps": [
                f"[Rule-Based] Ensure the uploaded photo shows a single '{expected_crop_group}' leaf in clear daylight.",
                "[Rule-Based] Verify whether the selected Crop Type matches the uploaded photograph.",
                "[Rule-Based] Consult a local agronomist for in-field diagnosis.",
            ],
            "preventive_measures": [],
            "expert_confirmation_needed": True,
            "model_provider": provider,
            "model_id": model_id,
            "disclaimer": PRELIMINARY_DISCLAIMER,
            "troubleshooting_hint": (
                f"Ambiguous / Crop-Class Mismatch: You selected '{crop_type}' ({expected_crop_group}), "
                f"but the model's top prediction belonged to a different crop ('{top['label']}', "
                f"{round(top_conf * 100, 1)}% model confidence). Because the image does not match a "
                f"supported '{expected_crop_group}' class cleanly, a reliable diagnosis is unavailable."
            ),
        }

    # 10. Valid, crop-aligned PlantVillage prediction
    top_label = top["label"]
    guidance = _lookup_rule_guidance(top_label)
    severity = guidance["severity"]
    if top_conf < 0.50 and severity != "none":
        severity = "unknown"

    symptoms_list = list(guidance["symptoms"])
    if expected_crop_group in HEALTHY_ONLY_PLANTVILLAGE_CROPS:
        symptoms_list.append(
            f"Coverage Limitation: For {expected_crop_group}, the 38-class PlantVillage dataset only contains "
            f"a '{expected_crop_group} — Healthy' class and 0 disease classes. A 'Healthy' prediction cannot "
            f"rule out {expected_crop_group} diseases."
        )
    symptoms_list.append(PLANTVILLAGE_LIMITATION_NOTICE)
    symptoms_list.append(CONFIDENCE_CALIBRATION_NOTE)

    return {
        "analysis_status": "completed",
        "predicted_condition": top_label,
        "model_confidence": top_conf,
        "raw_predictions": raw_preds_out,
        "visual_symptoms": symptoms_list,
        "severity": severity,
        "recommended_next_steps": guidance["next_steps"],
        "preventive_measures": guidance["preventive"],
        "expert_confirmation_needed": (
            guidance["expert_needed"]
            or (top_conf < 0.70)
            or (expected_crop_group in HEALTHY_ONLY_PLANTVILLAGE_CROPS)
        ),
        "model_provider": provider,
        "model_id": model_id,
        "disclaimer": PRELIMINARY_DISCLAIMER,
        "troubleshooting_hint": None,
    }
