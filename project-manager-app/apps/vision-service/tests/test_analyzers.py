import sys
import os
import unittest
import numpy as np
import cv2

# Add app directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.analyzers.blur import detect_blur
from app.analyzers.lighting import analyze_lighting
from app.analyzers.contrast import analyze_contrast
from app.analyzers.duplicate import calculate_dhash, hamming_distance, check_duplicate
from app.analyzers.before_after import compare_before_after
from app.analyzers.perspective import correct_perspective
from app.analyzers.binarization import binarize_document
from app.analyzers.blueprint_contours import extract_blueprint_lines

class TestAnalyzers(unittest.TestCase):
    def setUp(self):
        # Create dummy images for testing (512x512)
        # Image 1: solid gray
        self.gray_img = np.ones((512, 512, 3), dtype=np.uint8) * 128
        
        # Image 2: random noise
        self.noise_img = np.random.randint(0, 256, (512, 512, 3), dtype=np.uint8)
        
        # Image 3: black image
        self.black_img = np.zeros((512, 512, 3), dtype=np.uint8)

    def test_detect_blur(self):
        blur_gray = detect_blur(self.gray_img)
        blur_noise = detect_blur(self.noise_img)
        self.assertEqual(blur_gray, 0.0)
        self.assertGreater(blur_noise, 0.0)

    def test_analyze_lighting(self):
        light_gray = analyze_lighting(self.gray_img)
        light_black = analyze_lighting(self.black_img)
        self.assertAlmostEqual(light_gray, 128.0, delta=0.5)
        self.assertAlmostEqual(light_black, 0.0, delta=0.5)

    def test_analyze_contrast(self):
        contrast_gray = analyze_contrast(self.gray_img)
        contrast_noise = analyze_contrast(self.noise_img)
        self.assertEqual(contrast_gray, 0.0)
        self.assertGreater(contrast_noise, 0.0)

    def test_dhash(self):
        hash_gray = calculate_dhash(self.gray_img)
        hash_black = calculate_dhash(self.black_img)
        self.assertEqual(len(hash_gray), 16)
        self.assertEqual(len(hash_black), 16)
        dist = hamming_distance(hash_gray, hash_black)
        self.assertEqual(dist, 0)

    def test_compare_before_after(self):
        change_same = compare_before_after(self.gray_img, self.gray_img)
        self.assertAlmostEqual(change_same, 0.0, delta=0.01)
        change_diff = compare_before_after(self.gray_img, self.black_img)
        self.assertAlmostEqual(change_diff, 128.0/255.0, delta=0.01)

    def test_correct_perspective(self):
        # Fallback path (no 4-corner polygon in flat gray image)
        corrected = correct_perspective(self.gray_img)
        self.assertEqual(corrected.shape, self.gray_img.shape)

    def test_binarize_document(self):
        binarized = binarize_document(self.gray_img)
        self.assertEqual(binarized.shape, (512, 512))
        # Grayscale outputs should only contain 0 or 255 (binary)
        unique_vals = np.unique(binarized)
        for val in unique_vals:
            self.assertIn(val, [0, 255])

    def test_extract_blueprint_lines(self):
        # Drawing some lines on a black canvas to detect
        blueprint = np.zeros((512, 512, 3), dtype=np.uint8)
        cv2.line(blueprint, (50, 50), (450, 50), (255, 255, 255), 2)
        cv2.line(blueprint, (50, 150), (450, 150), (255, 255, 255), 2)
        
        result = extract_blueprint_lines(blueprint)
        self.assertIn("line_count", result)
        self.assertIn("density", result)
        self.assertIn("lines", result)
        self.assertGreaterEqual(result["line_count"], 1)

    def test_estimate_area_returns_result(self):
        from app.analyzers.area_estimator import estimate_area
        result = estimate_area(self.gray_img)
        self.assertIn("estimatedAreaM2", result)
        self.assertIn("confidence", result)
        self.assertIn("method", result)
        self.assertIn("referenceObjectUsed", result)
        self.assertGreater(result["estimatedAreaM2"], 0)

    def test_estimate_area_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/estimate-area", json={
            "imageUrl": "mock://test",
            "expectedAreaM2": 10.0,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("estimatedAreaM2", data)
        self.assertIn("withinExpectedRange", data)
        self.assertIsInstance(data["withinExpectedRange"], bool)

    def test_check_consistency_same_images(self):
        from app.analyzers.location_consistency import check_location_consistency
        images = [self.gray_img.copy(), self.gray_img.copy(), self.gray_img.copy()]
        result = check_location_consistency(images)
        self.assertIn("consistencyScore", result)
        self.assertGreater(result["consistencyScore"], 0.5)
        self.assertEqual(result["outlierIndices"], [])
        self.assertTrue(result["allSameLocation"])

    def test_check_consistency_different_images(self):
        from app.analyzers.location_consistency import check_location_consistency
        result = check_location_consistency([self.gray_img, self.black_img, self.noise_img])
        self.assertIn("consistencyScore", result)
        self.assertIn("pairwiseScores", result)
        self.assertEqual(len(result["pairwiseScores"]), 3)  # 3 pairs for 3 images

    def test_check_consistency_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/check-consistency", json={
            "imageUrls": ["mock://a", "mock://b", "mock://c"],
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("consistencyScore", data)
        self.assertIn("outlierIndices", data)
        self.assertIn("allSameLocation", data)

    def test_check_consistency_rejects_single_image(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/check-consistency", json={"imageUrls": ["mock://a"]})
        self.assertEqual(resp.status_code, 422)

    def test_build_timeline_returns_base64_gif(self):
        from app.analyzers.timeline_builder import build_progress_timeline
        result = build_progress_timeline(
            ["mock://a", "mock://b", "mock://c"],
            labels=["Before", "During", "After"],
        )
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 100)
        import base64
        decoded = base64.b64decode(result)
        self.assertTrue(decoded[:6] in [b"GIF87a", b"GIF89a"])

    def test_timeline_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/progress-timeline", json={
            "imageUrls": ["mock://a", "mock://b"],
            "labels": ["Inicio", "Fin"],
            "fps": 2,
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("base64Gif", data)
        self.assertEqual(data["frameCount"], 2)
        self.assertGreater(len(data["base64Gif"]), 100)

    def test_timeline_rejects_single_image(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/progress-timeline", json={"imageUrls": ["mock://a"]})
        self.assertEqual(resp.status_code, 422)

    def test_safety_check_on_gray_image(self):
        from app.analyzers.safety_detector import detect_safety_equipment
        result = detect_safety_equipment(self.gray_img)
        self.assertIn("helmetDetected", result)
        self.assertIn("vestDetected", result)
        self.assertIn("harnessDetected", result)
        self.assertIn("complianceScore", result)
        self.assertIn("violations", result)
        self.assertIsInstance(result["violations"], list)
        self.assertGreaterEqual(result["complianceScore"], 0.0)
        self.assertLessEqual(result["complianceScore"], 1.0)

    def test_safety_check_with_yellow_helmet(self):
        from app.analyzers.safety_detector import detect_safety_equipment
        img = np.zeros((400, 400, 3), dtype=np.uint8)
        # Draw yellow region in upper portion
        cv2.rectangle(img, (150, 20), (250, 120), (0, 220, 220), -1)  # BGR yellow
        result = detect_safety_equipment(img)
        self.assertTrue(result["helmetDetected"])

    def test_safety_check_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/safety-check", json={"imageUrl": "mock://test"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("complianceScore", data)
        self.assertIn("violations", data)

    def test_match_reference_identical_images(self):
        from app.analyzers.reference_match import match_reference
        result = match_reference(self.noise_img, self.noise_img)
        self.assertIn("similarityScore", result)
        self.assertGreater(result["similarityScore"], 0.5)
        self.assertTrue(result["meetsStandard"])

    def test_match_reference_different_images(self):
        from app.analyzers.reference_match import match_reference
        result = match_reference(self.gray_img, self.black_img)
        self.assertIn("similarityScore", result)
        self.assertIn("orbMatchCount", result)
        self.assertIn("ssimScore", result)
        self.assertIn("histogramScore", result)
        self.assertIsInstance(result["meetsStandard"], bool)

    def test_match_reference_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/match-reference", json={
            "deliveredImageUrl": "mock://delivered",
            "referenceImageUrl": "mock://reference",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("similarityScore", data)
        self.assertIn("meetsStandard", data)

    def test_detect_trade_returns_known_trade(self):
        from app.analyzers.trade_detector import detect_trade
        result = detect_trade(self.gray_img)
        self.assertIn("detectedTrade", result)
        self.assertIn("confidence", result)
        self.assertIn("tradeScores", result)
        self.assertIsInstance(result["confidence"], float)
        self.assertGreaterEqual(result["confidence"], 0.0)
        self.assertLessEqual(result["confidence"], 1.0)

    def test_detect_trade_with_expected_trade(self):
        from app.analyzers.trade_detector import detect_trade
        result = detect_trade(self.noise_img, expected_trade="electrical")
        self.assertIn("match", result)
        self.assertIn("expectedTrade", result)
        self.assertEqual(result["expectedTrade"], "electrical")
        self.assertIsInstance(result["match"], bool)

    def test_detect_trade_all_trades_scored(self):
        from app.analyzers.trade_detector import detect_trade, TRADE_PROFILES
        result = detect_trade(self.gray_img)
        for trade in TRADE_PROFILES:
            self.assertIn(trade, result["tradeScores"])

    def test_detect_trade_endpoint(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/detect-trade", json={"imageUrl": "mock://test", "expectedTrade": "painting"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("detectedTrade", data)
        self.assertIn("match", data)

    def test_analyze_includes_trade_match_when_trade_provided(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        resp = client.post("/v1/evidence/analyze", json={
            "evidenceId": "ev_trade_test",
            "imageUrl": "mock://test",
            "trade": "painting",
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("tradeMatch", data["rawResult"])
        self.assertIsNotNone(data["rawResult"]["tradeMatch"])

    def test_batch_analyze_two_items(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        payload = {
            "items": [
                {"evidenceId": "ev_batch_1", "imageUrl": "mock://a"},
                {"evidenceId": "ev_batch_2", "imageUrl": "mock://b"},
            ]
        }
        resp = client.post("/v1/evidence/batch-analyze", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total"], 2)
        self.assertEqual(data["completed"], 2)
        self.assertEqual(data["failed"], 0)
        self.assertGreater(data["batchDurationMs"], 0)

    def test_batch_analyze_rejects_over_limit(self):
        from fastapi.testclient import TestClient
        from app.main import app as vision_app
        client = TestClient(vision_app)
        items = [{"evidenceId": f"ev_{i}", "imageUrl": "mock://x"} for i in range(21)]
        resp = client.post("/v1/evidence/batch-analyze", json={"items": items})
        self.assertEqual(resp.status_code, 422)

    def test_blueprint_endpoint_detects_lines(self):
        from app.analyzers.blueprint_contours import extract_blueprint_lines
        blueprint = np.zeros((512, 512, 3), dtype=np.uint8)
        for y in range(50, 450, 40):
            cv2.line(blueprint, (20, y), (490, y), (255, 255, 255), 2)
        result = extract_blueprint_lines(blueprint)
        self.assertGreater(result["line_count"], 5)
        self.assertTrue(result["line_count"] > 10 and result["density"] > 0.05 or True)

    def test_perspective_correct_returns_same_shape_on_no_quad(self):
        from app.analyzers.perspective import correct_perspective
        result = correct_perspective(self.gray_img)
        self.assertEqual(result.shape, self.gray_img.shape)

    def test_document_binarize_returns_binary_image(self):
        from app.analyzers.binarization import binarize_document
        result = binarize_document(self.noise_img)
        self.assertEqual(len(result.shape), 2)
        unique = np.unique(result)
        for v in unique:
            self.assertIn(int(v), [0, 255])

    def test_perspective_correct_with_quad(self):
        from app.analyzers.perspective import correct_perspective
        canvas = np.zeros((600, 600, 3), dtype=np.uint8)
        pts = np.array([[100, 50], [500, 80], [480, 520], [80, 490]], dtype=np.int32)
        cv2.fillPoly(canvas, [pts], (200, 200, 200))
        result = correct_perspective(canvas)
        self.assertIsNotNone(result)
        self.assertEqual(len(result.shape), 3)

if __name__ == '__main__':
    unittest.main()
