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

if __name__ == '__main__':
    unittest.main()
