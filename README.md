# CropSentinel — AI-Powered Crop Health Monitoring and Decision Support Platform

**CropSentinel** is a full-stack agricultural intelligence and decision-support web application designed for farmers, agronomists, and precision agriculture teams. It combines field monitoring, live Open-Meteo weather intelligence, real Hugging Face plant-disease classification, a transparent risk-scoring rubric, a traceable Evidence Ledger, an actionable Rescue Planner, Budget Manthan expense tracking, and an explicit What-If financial simulator.

---

## 1. Key Features

1. **Overview Dashboard (`/`)**
   - Executive summary cards: Total Monitored Fields, Stored Assessments, Elevated-Risk Plots, Active Recommendations, and Estimated Potential Loss.
   - Crop Health Index trend chart and Healthy / Watch / High-Risk distribution chart.
   - Live Open-Meteo weather summary widget with user-selectable location.
   - Prioritized recommended actions and real-time platform activity feed.
   - Clearly labeled **DEMO PREVIEW MODE** when no user records exist yet (never fabricates sensor readings or AI results).

2. **Field Monitor (`/fields`)**
   - Full CRUD management for agricultural plots persisted in SQLite.
   - Tracks field name, crop type (Wheat, Rice, Maize, Cotton, Sugarcane, Tomato, Potato, Other), area & units (hectares/acres), location, planting date, crop growth stage, and field notes.
   - Interactive field detail inspector showing field-specific assessment history and quick links to Disease Detection and Rescue Planner.

3. **Disease Detection (`/detection`)**
   - Drag-and-drop and file-picker leaf image upload with client and server validation (JPEG, PNG, WEBP up to 10 MB, verified safely via Pillow).
   - Connects to the configured **Hugging Face Inference API** (`AI_MODEL_ID` + `HUGGINGFACE_API_KEY`).
   - **Honest AI Policy**: Never fabricates disease detections or confidence scores. If `HUGGINGFACE_API_KEY` is not configured or the remote model is unreachable, returns a clear `"unavailable"` status with setup instructions while still logging user observations and computing rule-based risk.
   - Clearly separates genuine model output from rule-based agronomic follow-up steps and preliminary disclaimers.

4. **Weather Intelligence (`/weather`)**
   - Live **Open-Meteo Geocoding API** search with debounced city/town/region lookup (never hardcoded to a single location).
   - Live **Open-Meteo Forecast API** integration displaying current temperature, feels-like temperature, relative humidity, wind speed, WMO weather codes, 24-hour chart, and 7-day forecast breakdown.
   - **Transparent Weather-Risk Rules**: Evaluates waterlogging/wash-off risk, heat stress, cold/chilling stress, and humid microclimate fungal favorability against configurable thresholds.

5. **Transparent Risk Assessment Engine**
   - Documented 0–100 additive rubric combining AI classification output, user-entered symptom observations, crop growth-stage sensitivity, and weather alerts.
   - Computes **Data Completeness (%)** and explicitly lists missing data gaps that reduce recommendation certainty.

6. **Reports & History — Crop Memory & Evidence Ledger (`/reports`)**
   - **Crop Memory**: Searchable, filterable assessment history table (by field, crop, risk category, date range, and text query) with detail modal, side-by-side comparison of any 2 assessments, and deletion confirmation.
   - **Evidence Ledger**: Traceable audit log linking every recommendation to its exact evidence source (`AI Model`, `Live Weather API`, `User Observation`, `Rule Engine`), confidence label, data gaps, and verification steps.
   - **Export & Print**: Working CSV export and print-friendly stylesheet.

7. **Rescue Planner (`/planner`)**
   - Generates structured, safe, non-prescriptive agronomic tasks from a field's latest assessment and growth stage.
   - Tasks grouped by urgency (`immediate`, `high`, `medium`, `routine`) with status workflow (`pending` → `in_progress` → `completed`), completion notes, due dates, and progress bar.

8. **Budget Manthan (`/budget`)**
   - Field-level input expense planner across categories: *Seeds, Fertilizer, Irrigation, Labor, Equipment, Crop Protection, Other*.
   - Transparent arithmetic for Planned Cost, Actual Cost, Remaining Budget, and Variance (`Planned − Actual`), with category comparison bar charts.

9. **What-If Simulator (`/simulator`)**
   - Interactive financial scenario simulator allowing users to adjust expected rainfall, temperature assumptions, irrigation availability, estimated crop loss %, input costs, expected yield, and sale price.
   - Displays explicit mathematical formulas, sensitivity curves across 0%–50% crop loss, and saved scenario comparisons in SQLite.

10. **Settings (`/settings`)**
    - Configure preferred farm location, default area units (`hectares` / `acres`), currency symbol (`₹`, `$`, `€`, `£`), and table density.
    - Live backend health diagnostics (`GET /api/health`) showing SQLite connectivity, Open-Meteo endpoint, and AI provider readiness without exposing secret keys.

---

## 2. Architecture & Directory Structure

```text
CropSentinel/
├── frontend/                       # React 18 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/             # Sidebar.tsx, Header.tsx, AppLayout.tsx
│   │   │   └── weather/            # LocationSearch.tsx (Open-Meteo geocoding modal)
│   │   ├── pages/                  # All 9 application pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── FieldMonitor.tsx
│   │   │   ├── DiseaseDetection.tsx
│   │   │   ├── Weather.tsx
│   │   │   ├── Reports.tsx
│   │   │   ├── RescuePlanner.tsx
│   │   │   ├── BudgetManthan.tsx
│   │   │   ├── WhatIfSimulator.tsx
│   │   │   └── Settings.tsx
│   │   ├── services/               # api.ts (Axios instance), cropsentinel.ts (typed API client)
│   │   ├── store/                  # weatherStore.ts (Zustand persisted preferences)
│   │   ├── types/                  # index.ts (TypeScript contracts matching backend schemas)
│   │   ├── App.tsx                 # React Router v6 route definitions
│   │   ├── main.tsx                # Application entry point
│   │   └── index.css               # Tailwind CSS + agricultural design system
│   ├── package.json
│   ├── vite.config.ts              # Proxies /api -> http://localhost:8000
│   └── tsconfig.json
├── backend/                        # Python FastAPI + SQLAlchemy Async + SQLite
│   ├── app/
│   │   ├── routers/
│   │   │   ├── health.py           # GET /api/health
│   │   │   ├── fields.py           # CRUD /api/fields
│   │   │   ├── weather.py          # GET /api/weather/search, /api/weather/forecast
│   │   │   ├── analysis.py         # POST /api/analysis (image upload + AI + risk engine)
│   │   │   ├── history.py          # GET/DELETE /api/history, GET /api/evidence
│   │   │   ├── planner.py          # CRUD /api/planner/tasks, POST /api/planner/generate/{field_id}
│   │   │   ├── budget.py           # CRUD /api/budget
│   │   │   ├── simulator.py        # POST /api/simulator/run, GET/DELETE /api/simulator/scenarios
│   │   │   └── reports.py          # GET /api/reports/summary
│   │   ├── services/
│   │   │   ├── weather_service.py  # Open-Meteo client & configurable weather-risk rules
│   │   │   ├── disease_service.py  # Hugging Face inference client & rule-based guidance
│   │   │   ├── risk_service.py     # Documented additive risk scoring rubric
│   │   │   └── planner_service.py  # Evidence-based rescue task generator
│   │   ├── config.py               # Pydantic Settings loaded from .env
│   │   ├── database.py             # Async SQLAlchemy engine & session management
│   │   ├── models.py               # ORM models (Field, Assessment, EvidenceEntry, RescueTask, BudgetItem, SimulationScenario)
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   └── main.py                 # FastAPI app initialization & CORS middleware
│   ├── requirements.txt
│   └── .env.example
├── .gitignore
└── README.md
```

---

## 3. Prerequisites

- **Node.js** v18+ (tested with Node.js v20.18.0) and **npm**
- **Python** 3.10+ (tested with Python 3.11)

---

## 4. Installation & Startup Instructions (Windows PowerShell)

### Step 1: Start the FastAPI Backend (`http://localhost:8000`)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt

# Copy environment template if .env does not exist
if (!(Test-Path .env)) { Copy-Item .env.example .env }

uvicorn app.main:app --reload --port 8000
```

- Interactive Swagger API documentation is available at: **`http://localhost:8000/docs`**
- Health check endpoint: **`http://localhost:8000/api/health`**

### Step 2: Start the React + Vite Frontend (`http://localhost:5173`)

Open a second terminal window:

```powershell
cd frontend
npm install
npm run dev
```

Open **`http://localhost:5173`** in your browser. Vite automatically proxies `/api/*` requests to `http://localhost:8000`.

---

## 5. Environment Configuration (`backend/.env`) & Enabling Live AI Disease Detection

Copy `backend/.env.example` to `backend/.env`:

```env
AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=
AI_MODEL_ID=linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification
DATABASE_URL=sqlite+aiosqlite:///./cropsentinel.db
FRONTEND_ORIGIN=http://localhost:5173,http://localhost:3000

OPEN_METEO_FORECAST_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_GEOCODING_URL=https://geocoding-api.open-meteo.com/v1/search

WEATHER_RAIN_HIGH_MM=25.0
WEATHER_TEMP_HEAT_STRESS_C=36.0
WEATHER_TEMP_COLD_STRESS_C=6.0
WEATHER_HUMIDITY_FUNGAL_RISK_PCT=80.0
```

### Step-by-Step Setup to Enable Live Hugging Face Leaf Classification

1. **Create a Hugging Face Access Token**:
   - Sign in at [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
   - Click **Create new token** (Fine-grained or Read token) and ensure the **"Make calls to Inference Providers"** permission is checked.
2. **Add `HUGGINGFACE_API_KEY` to `backend/.env`**:
   - Open `backend/.env` and set your token (never commit `backend/.env` to Git or place the token in any `frontend/` file):
     ```env
     HUGGINGFACE_API_KEY=hf_your_actual_token_here
     AI_MODEL_ID=linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification
     ```
3. **Restart the FastAPI Backend**:
   - Stop the running backend server (`Ctrl+C`) and restart it from the `backend` directory:
     ```powershell
     cd c:\Users\sagar\OneDrive\Desktop\Cropsentinel\backend
     .\.venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000
     ```
4. **Verify AI Configuration**:
   - Check `http://127.0.0.1:8000/api/health` — `"ai_configured"` will now report `true`.
   - Check `http://127.0.0.1:8000/api/analysis/model-info` — returns the verified model specification, 14 directly supported crops, and 38 PlantVillage classes.

### Verified Plant-Disease Model Specification (`linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification`)
- **Architecture**: MobileNetV2 (`224x224` RGB leaf image classification fine-tuned on the 38-class PlantVillage dataset).
- **Directly Supported Crops (14)**:
  - **11 Crops with Healthy & Disease Classes**: `Tomato` (10 classes), `Potato` (3 classes), `Corn (Maize)` (4 classes), `Apple` (4 classes), `Grape` (4 classes), `Bell Pepper / Chilli` (2 classes), `Peach` (2 classes), `Orange / Citrus` (1 class: Huanglongbing/Citrus Greening), `Strawberry` (2 classes), `Cherry` (2 classes), `Squash / Cucurbit` (1 class: Powdery Mildew).
  - **3 Crops with Healthy-Only Classes (0 Disease Classes in PlantVillage)**: `Soybean` (`Soybean___healthy`), `Blueberry` (`Blueberry___healthy`), `Raspberry` (`Raspberry___healthy`).
  - **Unsupported Field Crops**: `Wheat`, `Rice/Paddy`, `Cotton`, `Sugarcane`, `Mustard`, and `Chickpea` have 0 classes in PlantVillage; when selected, CropSentinel honestly reports AI leaf classification as `"unavailable"` while running the Rule-Based Risk Engine and 182-Crop Suitability Model.
- **Expected Inference API Response Format (`id2label` 0..37)**:
  ```json
  [
    { "label": "Tomato___Early_blight", "score": 0.9142 },
    { "label": "Tomato___Septoria_leaf_spot", "score": 0.0518 }
  ]
  ```
- **PlantVillage Dataset Limitation & Confidence Calibration Policy**:
  - **PlantVillage Limitation**: Trained on controlled studio photographs of single detached leaves on uniform backgrounds. Real-world field images with soil backgrounds, multiple leaves, or mixed abiotic stresses may differ from the training distribution. Never use model output as standalone proof of field disease.
  - **Model Confidence vs. Calibrated Probability**: Model confidence is an uncalibrated softmax score across the 38 trained classes—it is **not** a scientifically or medically calibrated probability of infection.
  - **Honest Fallback**: Non-plant generic labels, cross-crop mismatches, ambiguous predictions (`< 0.35`), or missing `HUGGINGFACE_API_KEY` return `analysis_status: "unavailable"` without fabricating a diagnosis or confidence score.
- **Weather API**: Uses public Open-Meteo endpoints (`https://geocoding-api.open-meteo.com/v1/search` and `https://api.open-meteo.com/v1/forecast`). No API key is required.
- **Database Behavior**: Automatically initializes `backend/cropsentinel.db` on startup and persists all records across server restarts and page reloads.

---

## 6. Summary of Backend API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System, SQLite, weather, and AI configuration status |
| `GET` | `/api/fields` | List all monitored fields |
| `POST` | `/api/fields` | Create a new field record |
| `GET` | `/api/fields/{field_id}` | Get details for a single field |
| `PUT` | `/api/fields/{field_id}` | Update field details, stage, or notes |
| `DELETE` | `/api/fields/{field_id}` | Delete a field and its associated records |
| `POST` | `/api/analysis` | Upload leaf image + run AI inference & risk engine |
| `GET` | `/api/history` | List stored crop assessments with optional filters |
| `GET` | `/api/history/{assessment_id}` | Get a specific assessment record |
| `DELETE` | `/api/history/{assessment_id}` | Delete an assessment record |
| `GET` | `/api/evidence` | List traceable Evidence Ledger entries |
| `GET` | `/api/weather/search` | Search locations via Open-Meteo Geocoding API |
| `GET` | `/api/weather/forecast` | Fetch current, hourly, daily forecast & risk alerts |
| `GET` | `/api/planner/tasks` | List rescue planner tasks |
| `POST` | `/api/planner/tasks` | Create a custom rescue task |
| `POST` | `/api/planner/generate/{field_id}` | Auto-generate rescue tasks from field evidence |
| `PUT` | `/api/planner/tasks/{task_id}` | Update task status, urgency, or completion notes |
| `DELETE` | `/api/planner/tasks/{task_id}` | Delete a rescue task |
| `GET` | `/api/budget` | Get Budget Manthan items, totals, and category summary |
| `POST` | `/api/budget` | Add a new budget/expense item |
| `PUT` | `/api/budget/{item_id}` | Update a budget item |
| `DELETE` | `/api/budget/{item_id}` | Delete a budget item |
| `POST` | `/api/simulator/run` | Run What-If scenario calculation & sensitivity curve |
| `GET` | `/api/simulator/scenarios` | List saved What-If scenarios |
| `DELETE` | `/api/simulator/scenarios/{scenario_id}` | Delete a saved scenario |
| `GET` | `/api/reports/summary` | Aggregated metrics for Overview and Reports pages |

---

## 7. Troubleshooting, Current Limitations & Security Notice

- **AI Model Cold Starts**: Free Hugging Face serverless inference endpoints may take 20–30 seconds to wake up on the first request. If a timeout occurs, wait 30 seconds and click Retry.
- **Agronomic Disclaimer**: Image-based leaf classification and rule-based risk scores are preliminary decision-support signals. They cannot measure soil nutrient concentrations or guarantee yield outcomes. Always consult a qualified local agronomist before applying chemical crop protection products.
- **Security & Deployment Notice**: Secret API keys are kept strictly in `backend/.env` and are never exposed to the frontend bundle. This local prototype does not implement user authentication or role-based access control and should not be exposed directly to the public internet without adding an authentication layer.
## Live Website
**Live Demo:** https://crop-sentinel-three.vercel.app/login

