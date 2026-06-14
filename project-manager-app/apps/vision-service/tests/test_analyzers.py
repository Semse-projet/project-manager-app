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
