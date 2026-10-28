"""
End-to-end verification test suite for CropSentinel FastAPI backend & SQLite persistence.
Runs each test case explicitly and reports actual pass/fail counts.
"""
import asyncio
import io
import sys
import traceback
from PIL import Image
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import init_db, engine


async def main():
    passed = 0
    failed = 0
    results = []

    def record(name: str, ok: bool, detail: str = ""):
        nonlocal passed, failed
        if ok:
            passed += 1
            results.append(f"[PASS] {name}" + (f" — {detail}" if detail else ""))
        else:
            failed += 1
            results.append(f"[FAIL] {name}" + (f" — {detail}" if detail else ""))

    try:
        await init_db()
        record("Database schema initialization (init_db)", True)
    except Exception as exc:
        record("Database schema initialization (init_db)", False, str(exc))
        for line in results:
            print(line)
        sys.exit(1)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Test 1: GET /api/health
        try:
            r = await ac.get("/api/health")
            data = r.json()
            ok = r.status_code == 200 and data.get("database_connected") is True and "ai_configured" in data
            record("GET /api/health", ok, f"status={r.status_code}, db={data.get('database_connected')}")
        except Exception as exc:
            record("GET /api/health", False, str(exc))

        # Test 2: POST /api/fields
        fid = None
        try:
            r = await ac.post(
                "/api/fields",
                json={
                    "name": "Verification Wheat Plot",
                    "crop_type": "Wheat",
                    "area_value": 4.2,
                    "area_unit": "hectares",
                    "location": "Test District",
                    "planting_date": "2026-10-01",
                    "growth_stage": "Flowering",
                    "notes": "Yellowing observed on lower leaves",
                },
            )
            data = r.json()
            fid = data.get("id")
            ok = r.status_code == 201 and fid is not None and data.get("name") == "Verification Wheat Plot"
            record("POST /api/fields (create field in SQLite)", ok, f"status={r.status_code}, field_id={fid}")
        except Exception as exc:
            record("POST /api/fields (create field in SQLite)", False, str(exc))

        # Test 3: GET /api/fields & PUT /api/fields/{fid}
        try:
            r_list = await ac.get("/api/fields")
            r_upd = await ac.put(f"/api/fields/{fid}", json={"growth_stage": "Fruiting/Grain Fill"})
            ok = (
                r_list.status_code == 200
                and any(f["id"] == fid for f in r_list.json())
                and r_upd.status_code == 200
                and r_upd.json().get("growth_stage") == "Fruiting/Grain Fill"
            )
            record("GET & PUT /api/fields (read & update persisted field)", ok, f"status={r_upd.status_code}")
        except Exception as exc:
            record("GET & PUT /api/fields (read & update persisted field)", False, str(exc))

        # Test 4: POST /api/analysis (image upload + honest AI status + risk rubric)
        aid = None
        try:
            buf = io.BytesIO()
            Image.new("RGB", (64, 64), color=(40, 140, 50)).save(buf, format="JPEG")
            buf.seek(0)
            r = await ac.post(
                "/api/analysis",
                data={
                    "crop_type": "Wheat",
                    "growth_stage": "Flowering",
                    "field_id": str(fid),
                    "user_notes": "Yellow spots and rust pustules on lower leaves",
                },
                files={"file": ("sample_leaf.jpg", buf.getvalue(), "image/jpeg")},
            )
            data = r.json()
            aid = data.get("id")
            ok = (
                r.status_code == 200
                and aid is not None
                and data.get("analysis_status") in ("completed", "unavailable")
                and isinstance(data.get("risk_score"), (int, float))
                and len(data.get("risk_factors", [])) > 0
            )
            record(
                "POST /api/analysis (upload validation, honest AI status & risk score)",
                ok,
                f"status={r.status_code}, analysis_status={data.get('analysis_status')}, risk_score={data.get('risk_score')}",
            )
        except Exception as exc:
            record("POST /api/analysis", False, traceback.format_exc())

        # Test 5: GET /api/history & GET /api/evidence
        try:
            r_hist = await ac.get("/api/history", params={"field_id": fid})
            r_ev = await ac.get("/api/evidence", params={"field_id": fid})
            ok = (
                r_hist.status_code == 200
                and len(r_hist.json()) >= 1
                and r_ev.status_code == 200
                and len(r_ev.json()) >= 1
            )
            record(
                "GET /api/history & GET /api/evidence (Crop Memory & Evidence Ledger)",
                ok,
                f"history_count={len(r_hist.json())}, evidence_count={len(r_ev.json())}",
            )
        except Exception as exc:
            record("GET /api/history & GET /api/evidence", False, str(exc))

        # Test 6: POST /api/planner/generate/{fid} & PUT /api/planner/tasks/{tid}
        task_ids = []
        try:
            r_gen = await ac.post(f"/api/planner/generate/{fid}")
            tasks = r_gen.json()
            task_ids = [t["id"] for t in tasks]
            r_upd = await ac.put(
                f"/api/planner/tasks/{task_ids[0]}",
                json={"status": "completed", "completion_notes": "Scouted 20 plants across W-transect"},
            )
            ok = (
                r_gen.status_code == 201
                and len(task_ids) >= 1
                and r_upd.status_code == 200
                and r_upd.json().get("status") == "completed"
            )
            record(
                "POST /api/planner/generate & PUT /api/planner/tasks (Rescue Planner)",
                ok,
                f"generated_tasks={len(task_ids)}, updated_status={r_upd.json().get('status')}",
            )
        except Exception as exc:
            record("POST /api/planner/generate & PUT /api/planner/tasks", False, str(exc))

        # Test 7: POST & GET /api/budget (Budget Manthan)
        bid = None
        try:
            r_b = await ac.post(
                "/api/budget",
                json={
                    "field_id": fid,
                    "category": "Seeds",
                    "item_name": "Certified Wheat Seed",
                    "planned_cost": 15000.0,
                    "actual_cost": 14200.0,
                    "notes": "Lot #44",
                },
            )
            bid = r_b.json().get("id")
            r_sum = await ac.get("/api/budget", params={"field_id": fid})
            sum_data = r_sum.json()
            ok = (
                r_b.status_code == 201
                and r_sum.status_code == 200
                and sum_data.get("total_planned") == 15000.0
                and sum_data.get("total_actual") == 14200.0
                and sum_data.get("variance") == 800.0
            )
            record(
                "POST & GET /api/budget (Budget Manthan arithmetic)",
                ok,
                f"planned={sum_data.get('total_planned')}, actual={sum_data.get('total_actual')}, variance={sum_data.get('variance')}",
            )
        except Exception as exc:
            record("POST & GET /api/budget", False, str(exc))

        # Test 8: POST /api/simulator/run (What-If Simulator explicit formulas)
        sid = None
        try:
            r_sim = await ac.post(
                "/api/simulator/run",
                json={
                    "name": "Verification Scenario",
                    "field_id": fid,
                    "crop_type": "Wheat",
                    "expected_rainfall_mm": 110.0,
                    "temp_assumption_c": 25.0,
                    "irrigation_available": True,
                    "estimated_loss_pct": 10.0,
                    "input_cost": 30000.0,
                    "expected_yield_units": 40.0,
                    "yield_unit": "quintals",
                    "sale_price_per_unit": 2000.0,
                    "save_scenario": True,
                },
            )
            sdata = r_sim.json()
            sid = sdata.get("id")
            ok = (
                r_sim.status_code == 200
                and sdata.get("baseline_revenue") == 80000.0
                and sdata.get("adjusted_yield") == 36.0
                and sdata.get("estimated_revenue") == 72000.0
                and sdata.get("estimated_profit") == 42000.0
                and sdata.get("potential_loss_amount") == 8000.0
                and len(sdata.get("sensitivity_curve", [])) == 9
            )
            record(
                "POST /api/simulator/run (What-If Simulator formulas & sensitivity curve)",
                ok,
                f"baseline_rev={sdata.get('baseline_revenue')}, est_profit={sdata.get('estimated_profit')}",
            )
        except Exception as exc:
            record("POST /api/simulator/run", False, str(exc))

        # Test 9: GET /api/reports/summary
        try:
            r_rep = await ac.get("/api/reports/summary")
            rep_data = r_rep.json()
            ok = (
                r_rep.status_code == 200
                and rep_data.get("is_demo") is False
                and rep_data["summary_cards"]["total_fields"] >= 1
                and rep_data["summary_cards"]["total_assessments"] >= 1
            )
            record(
                "GET /api/reports/summary (live SQLite aggregation)",
                ok,
                f"is_demo={rep_data.get('is_demo')}, fields={rep_data['summary_cards']['total_fields']}",
            )
        except Exception as exc:
            record("GET /api/reports/summary", False, str(exc))

        # Test 10: Clean up test records (DELETE endpoints)
        try:
            if sid:
                await ac.delete(f"/api/simulator/scenarios/{sid}")
            if bid:
                await ac.delete(f"/api/budget/{bid}")
            for tid in task_ids:
                await ac.delete(f"/api/planner/tasks/{tid}")
            if aid:
                await ac.delete(f"/api/history/{aid}")
            if fid:
                r_del = await ac.delete(f"/api/fields/{fid}")
                ok = r_del.status_code == 204
            else:
                ok = False
            record("DELETE endpoints cleanup (/simulator, /budget, /planner, /history, /fields)", ok)
        except Exception as exc:
            record("DELETE endpoints cleanup", False, str(exc))

        # Test 11: POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me
        auth_token = None
        try:
            import time as _t
            test_email = f"farmer_{int(_t.time() * 1000)}@cropsentinel.in"
            r_sig = await ac.post(
                "/api/auth/signup",
                json={
                    "full_name": "Ramesh Kumar",
                    "email": test_email,
                    "mobile_number": "9876543210",
                    "password": "SecurePassword123",
                    "preferred_language": "hi",
                },
            )
            sig_data = r_sig.json()
            auth_token = sig_data.get("token")
            r_dup = await ac.post(
                "/api/auth/signup",
                json={
                    "full_name": "Ramesh Kumar",
                    "email": test_email,
                    "mobile_number": "9876543210",
                    "password": "SecurePassword123",
                },
            )
            r_log = await ac.post(
                "/api/auth/login",
                json={"email": test_email, "password": "SecurePassword123"},
            )
            r_me = await ac.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            ok = (
                r_sig.status_code == 201
                and bool(auth_token)
                and r_dup.status_code == 409
                and r_log.status_code == 200
                and r_me.status_code == 200
                and r_me.json()["user"]["email"] == test_email
            )
            record(
                "POST /api/auth/signup, /login & GET /api/auth/me (real PBKDF2 auth & duplicate check)",
                ok,
                f"signup={r_sig.status_code}, dup={r_dup.status_code}, login={r_log.status_code}",
            )
        except Exception as exc:
            record("POST /api/auth/signup, /login & GET /api/auth/me", False, str(exc))

        # Test 12: POST & GET /api/farmer/profile (Farmer Details persistence)
        try:
            headers = {"Authorization": f"Bearer {auth_token}"}
            r_fp = await ac.post(
                "/api/farmer/profile",
                headers=headers,
                json={
                    "farmer_name": "Ramesh Kumar",
                    "mobile_number": "9876543210",
                    "state": "Madhya Pradesh",
                    "district": "Sehore",
                    "village_town": "Ashta",
                    "total_land_acres": 5.5,
                    "soil_type": "Black (Regur)",
                    "irrigation_source": "Borewell / Tubewell",
                    "main_crop": "Wheat",
                    "growing_season": "Rabi",
                    "budget_per_acre": 18000.0,
                    "preferred_language": "hi",
                },
            )
            r_fp_get = await ac.get("/api/farmer/profile", headers=headers)
            fp_data = r_fp_get.json()
            ok = (
                r_fp.status_code == 200
                and r_fp_get.status_code == 200
                and fp_data.get("state") == "Madhya Pradesh"
                and fp_data.get("district") == "Sehore"
                and fp_data.get("total_land_acres") == 5.5
            )
            record(
                "POST & GET /api/farmer/profile (Farmer Details persistence)",
                ok,
                f"state={fp_data.get('state')}, land={fp_data.get('total_land_acres')} acres",
            )
        except Exception as exc:
            record("POST & GET /api/farmer/profile", False, str(exc))

        # Test 13: POST & GET /api/crops (Crop Details 5 sections + photo upload + undefined prevention)
        try:
            headers = {"Authorization": f"Bearer {auth_token}"}
            buf = io.BytesIO()
            Image.new("RGB", (80, 80), color=(35, 130, 45)).save(buf, format="JPEG")
            buf.seek(0)
            r_cr = await ac.post(
                "/api/crops",
                headers=headers,
                data={
                    "crop_name": "Wheat",
                    "crop_variety": "HI-1544 (Sharbati)",
                    "field_location": "Ashta, Sehore, Madhya Pradesh",
                    "sowing_date": "2026-10-15",
                    "growth_stage": "Vegetative",
                    "growth_progress_pct": "35",
                    "irrigation_method": "Drip Irrigation",
                    "recent_rainfall_mm": "18.5",
                    "soil_moisture_pct": "62",
                    "field_temperature_c": "24.5",
                    "humidity_pct": "58",
                    "fertilizer_used": "DAP + Urea top dressing",
                    "pesticide_used": "undefined",  # Verify literal 'undefined' is sanitized to ''
                    "visible_symptoms": "Mild yellowing on lower leaf tips",
                },
                files={"photo": ("wheat_leaf.jpg", buf.getvalue(), "image/jpeg")},
            )
            r_cr_lat = await ac.get("/api/crops/latest", headers=headers)
            cr_data = r_cr_lat.json()
            ok = (
                r_cr.status_code == 201
                and r_cr_lat.status_code == 200
                and cr_data.get("crop_name") == "Wheat"
                and cr_data.get("crop_variety") == "HI-1544 (Sharbati)"
                and cr_data.get("pesticide_used") == ""
                and bool(cr_data.get("image_url"))
            )
            record(
                "POST & GET /api/crops (Crop Details 5-section persistence & photo upload)",
                ok,
                f"crop={cr_data.get('crop_name')}, photo={cr_data.get('image_url')}, pesticide_sanitized={cr_data.get('pesticide_used') == ''}",
            )
        except Exception as exc:
            record("POST & GET /api/crops", False, str(exc))

        # Test 15: Trained 182-Crop Reference Catalogue & Suitability Model (/api/crops/catalogue, /model/evaluate, /model/recommend)
        try:
            r_cat = await ac.get("/api/crops/catalogue")
            cat_data = r_cat.json()
            r_eval = await ac.post(
                "/api/crops/model/evaluate",
                json={
                    "crop_name": "Wheat",
                    "field_temperature_c": 34.0,
                    "soil_moisture_pct": 22.0,
                    "humidity_pct": 50.0,
                    "soil_type": "Loamy",
                    "growth_stage": "Flowering",
                },
            )
            eval_data = r_eval.json()
            r_rec = await ac.post(
                "/api/crops/model/recommend",
                json={"temperature_c": 22.0, "annual_rainfall_mm": 650.0, "soil_ph": 6.8, "season": "Rabi", "top_k": 5},
            )
            rec_data = r_rec.json()
            hr_eval = eval_data.get("healthy_rate_evaluation") or {}
            ok = (
                r_cat.status_code == 200
                and cat_data.get("total") == 182
                and cat_data.get("model_version") == "ecocrop-icar-182-v2.0"
                and cat_data.get("metrics", {}).get("dataset_columns_trained") == 19
                and r_eval.status_code == 200
                and eval_data.get("matched") is True
                and eval_data.get("overall_status") == "stress_alert"
                and len(eval_data.get("alerts", [])) >= 1
                and bool(eval_data.get("visual_ideal_leaf_colour_by_stage"))
                and isinstance(hr_eval.get("healthy_rate_pct"), (int, float))
                and len(hr_eval.get("components", [])) == 4
                and r_rec.status_code == 200
                and rec_data.get("count") == 5
            )
            record(
                "GET /api/crops/catalogue & POST /api/crops/model/evaluate (182-Crop 19-Column Trained Model v2.0)",
                ok,
                f"catalogue_total={cat_data.get('total')}, version={cat_data.get('model_version')}, healthy_rate={hr_eval.get('healthy_rate_pct')}%, recs={rec_data.get('count')}",
            )
        except Exception as exc:
            record("182-Crop Trained Model endpoints", False, str(exc))

        # Test 16: GET /api/analysis/model-info & Plant-Disease Label Verification
        try:
            from app.services.disease_service import _is_valid_plant_disease_label
            r_mi = await ac.get("/api/analysis/model-info")
            mi_data = r_mi.json()
            valid_plant = _is_valid_plant_disease_label("Tomato___Early_blight") and _is_valid_plant_disease_label("Tomato with Early Blight")
            reject_generic = not _is_valid_plant_disease_label("sports car") and not _is_valid_plant_disease_label("tabby cat")
            ok = (
                r_mi.status_code == 200
                and len(mi_data.get("supported_crops", [])) == 14
                and len(mi_data.get("supported_classes", [])) == 38
                and "softmax score" in mi_data.get("confidence_calibration_note", "").lower()
                and valid_plant is True
                and reject_generic is True
            )
            record(
                "GET /api/analysis/model-info & Plant-Disease Classifier Label Validation",
                ok,
                f"crops={len(mi_data.get('supported_crops', []))}, classes={len(mi_data.get('supported_classes', []))}, generic_rejected={reject_generic}",
            )
        except Exception as exc:
            record("GET /api/analysis/model-info & Label Validation", False, str(exc))

        # Test 17: Mocked Successful Inference via POST /api/analysis (Tomato___Early_blight)
        try:
            from unittest.mock import patch, AsyncMock
            import httpx
            from app.config import settings

            buf = io.BytesIO()
            Image.new("RGB", (224, 224), color=(50, 140, 60)).save(buf, format="JPEG")
            img_bytes = buf.getvalue()

            mock_hf_resp = httpx.Response(
                status_code=200,
                json=[
                    {"label": "Tomato___Early_blight", "score": 0.9142},
                    {"label": "Tomato___Septoria_leaf_spot", "score": 0.0518},
                    {"label": "Tomato___healthy", "score": 0.0190},
                ],
            )
            with patch.object(settings, "huggingface_api_key", "hf_test_mock_token_123"), patch(
                "app.services.disease_service._post_to_huggingface",
                new=AsyncMock(return_value=mock_hf_resp),
            ):
                r_ok = await ac.post(
                    "/api/analysis",
                    data={
                        "crop_type": "Tomato",
                        "growth_stage": "Flowering",
                        "user_notes": "Concentric brown rings on lower leaves",
                    },
                    files={"file": ("tomato_leaf.jpg", img_bytes, "image/jpeg")},
                )
                d_ok = r_ok.json()
                mock_aid = d_ok.get("id")
                ok = (
                    r_ok.status_code == 200
                    and d_ok.get("analysis_status") == "completed"
                    and d_ok.get("predicted_condition") == "Tomato — Early Blight"
                    and d_ok.get("model_confidence") == 0.9142
                    and len(d_ok.get("raw_predictions", [])) == 3
                    and "softmax score" in d_ok.get("disclaimer", "").lower()
                    and "plantvillage" in d_ok.get("disclaimer", "").lower()
                )
                if mock_aid:
                    await ac.delete(f"/api/history/{mock_aid}")
                record(
                    "Mocked Successful Inference (Tomato___Early_blight -> completed, confidence=0.9142)",
                    ok,
                    f"condition={d_ok.get('predicted_condition')}, conf={d_ok.get('model_confidence')}",
                )
        except Exception as exc:
            record("Mocked Successful Inference", False, traceback.format_exc())

        # Test 18: Missing Credentials Honest Fallback (HUGGINGFACE_API_KEY='')
        try:
            from unittest.mock import patch
            from app.config import settings
            from app.services.disease_service import analyze_crop_image

            buf = io.BytesIO()
            Image.new("RGB", (128, 128), color=(60, 150, 60)).save(buf, format="JPEG")
            with patch.object(settings.__class__, "effective_hf_key", property(lambda self: "")):
                res_missing = await analyze_crop_image(
                    image_bytes=buf.getvalue(),
                    filename="tomato.jpg",
                    crop_type="Tomato",
                )
            ok = (
                res_missing["analysis_status"] == "unavailable"
                and res_missing["predicted_condition"] is None
                and res_missing["model_confidence"] is None
                and "HUGGINGFACE_API_KEY" in (res_missing.get("troubleshooting_hint") or "")
            )
            record(
                "Missing API Credentials Honest Fallback (HUGGINGFACE_API_KEY='')",
                ok,
                f"status={res_missing['analysis_status']}, predicted={res_missing['predicted_condition']}",
            )
        except Exception as exc:
            record("Missing API Credentials Honest Fallback", False, str(exc))

        # Test 19: Unsupported Crop Class, Cross-Crop Mismatch, Low-Confidence Ambiguity & Non-Plant Rejection
        try:
            from unittest.mock import patch, AsyncMock
            import httpx
            from app.config import settings
            from app.services.disease_service import analyze_crop_image

            buf = io.BytesIO()
            Image.new("RGB", (128, 128), color=(60, 150, 60)).save(buf, format="JPEG")
            img_bytes = buf.getvalue()

            # 19a: Unsupported crop (Wheat)
            res_wheat = await analyze_crop_image(img_bytes, "wheat.jpg", "Wheat")
            # 19b: Cross-crop mismatch (uploaded Tomato, model predicts Apple___Apple_scab)
            with patch.object(settings, "huggingface_api_key", "hf_test_mock_token_123"), patch(
                "app.services.disease_service._post_to_huggingface",
                new=AsyncMock(return_value=httpx.Response(200, json=[{"label": "Apple___Apple_scab", "score": 0.88}])),
            ):
                res_mismatch = await analyze_crop_image(img_bytes, "tomato.jpg", "Tomato")
            # 19c: Low confidence ambiguity (< 0.35)
            with patch.object(settings, "huggingface_api_key", "hf_test_mock_token_123"), patch(
                "app.services.disease_service._post_to_huggingface",
                new=AsyncMock(return_value=httpx.Response(200, json=[{"label": "Tomato___Early_blight", "score": 0.21}])),
            ):
                res_low = await analyze_crop_image(img_bytes, "tomato.jpg", "Tomato")
            # 19d: Generic non-plant label rejection
            with patch.object(settings, "huggingface_api_key", "hf_test_mock_token_123"), patch(
                "app.services.disease_service._post_to_huggingface",
                new=AsyncMock(return_value=httpx.Response(200, json=[{"label": "sports car", "score": 0.99}])),
            ):
                res_generic = await analyze_crop_image(img_bytes, "car.jpg", "Tomato")

            ok = (
                res_wheat["analysis_status"] == "unavailable"
                and res_wheat["predicted_condition"] is None
                and "Unsupported Crop Class" in (res_wheat.get("troubleshooting_hint") or "")
                and res_mismatch["analysis_status"] == "unavailable"
                and res_mismatch["predicted_condition"] is None
                and "Crop-Class Mismatch" in (res_mismatch.get("troubleshooting_hint") or "")
                and res_low["analysis_status"] == "unavailable"
                and res_low["predicted_condition"] is None
                and res_generic["analysis_status"] == "unavailable"
                and res_generic["predicted_condition"] is None
            )
            record(
                "Unsupported Crop (Wheat), Cross-Crop Mismatch, Low-Confidence & Generic Label Rejection",
                ok,
                f"wheat={res_wheat['analysis_status']}, mismatch={res_mismatch['analysis_status']}, low_conf={res_low['analysis_status']}, generic={res_generic['analysis_status']}",
            )
        except Exception as exc:
            record("Unsupported Crop & Invalid Model Response Handling", False, traceback.format_exc())

        # Test 20: Provider Failures (Timeout, HTTP 401 Auth, HTTP 429 Rate Limit, HTTP 503 Cold Start)
        try:
            from unittest.mock import patch, AsyncMock
            import httpx
            from app.config import settings
            from app.services.disease_service import analyze_crop_image

            buf = io.BytesIO()
            Image.new("RGB", (128, 128), color=(60, 150, 60)).save(buf, format="JPEG")
            img_bytes = buf.getvalue()

            with patch.object(settings, "huggingface_api_key", "hf_test_mock_token_123"):
                with patch(
                    "app.services.disease_service._post_to_huggingface",
                    new=AsyncMock(side_effect=httpx.TimeoutException("Inference timed out")),
                ):
                    res_timeout = await analyze_crop_image(img_bytes, "t.jpg", "Tomato")
                with patch(
                    "app.services.disease_service._post_to_huggingface",
                    new=AsyncMock(return_value=httpx.Response(401, json={"error": "Invalid token"})),
                ):
                    res_401 = await analyze_crop_image(img_bytes, "t.jpg", "Tomato")
                with patch(
                    "app.services.disease_service._post_to_huggingface",
                    new=AsyncMock(return_value=httpx.Response(429, json={"error": "Rate limit"})),
                ):
                    res_429 = await analyze_crop_image(img_bytes, "t.jpg", "Tomato")
                with patch(
                    "app.services.disease_service._post_to_huggingface",
                    new=AsyncMock(return_value=httpx.Response(503, json={"error": "Model loading"})),
                ):
                    res_503 = await analyze_crop_image(img_bytes, "t.jpg", "Tomato")

            ok = (
                res_timeout["analysis_status"] == "unavailable"
                and "timed out" in (res_timeout.get("troubleshooting_hint") or "").lower()
                and res_401["analysis_status"] == "unavailable"
                and "401" in (res_401.get("troubleshooting_hint") or "")
                and res_429["analysis_status"] == "unavailable"
                and "429" in (res_429.get("troubleshooting_hint") or "")
                and res_503["analysis_status"] == "unavailable"
                and "503" in (res_503.get("troubleshooting_hint") or "")
            )
            record(
                "External Provider Failures (Timeout, HTTP 401, HTTP 429, HTTP 503 -> honest unavailable)",
                ok,
                f"timeout={res_timeout['analysis_status']}, 401={res_401['analysis_status']}, 429={res_429['analysis_status']}, 503={res_503['analysis_status']}",
            )
        except Exception as exc:
            record("External Provider Failures", False, traceback.format_exc())

        # Test 21: Unsupported Image Format & Corrupted Image Validation on POST /api/analysis
        try:
            r_bad_mime = await ac.post(
                "/api/analysis",
                data={"crop_type": "Tomato", "growth_stage": "Vegetative"},
                files={"file": ("notes.txt", b"not an image", "text/plain")},
            )
            r_corrupt = await ac.post(
                "/api/analysis",
                data={"crop_type": "Tomato", "growth_stage": "Vegetative"},
                files={"file": ("broken.jpg", b"corrupted_binary_bytes", "image/jpeg")},
            )
            ok = r_bad_mime.status_code == 400 and r_corrupt.status_code == 400
            record(
                "Unsupported Image Format & Corrupted Image Rejection (HTTP 400)",
                ok,
                f"bad_mime={r_bad_mime.status_code}, corrupt_bytes={r_corrupt.status_code}",
            )
        except Exception as exc:
            record("Unsupported Image Format & Corrupted Image Rejection", False, str(exc))

    await engine.dispose()

    print("\n================ VERIFICATION RESULTS ================")
    for line in results:
        print(line)
    print(f"======================================================")
    print(f"TOTAL TESTS: {passed + failed} | PASSED: {passed} | FAILED: {failed}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())
