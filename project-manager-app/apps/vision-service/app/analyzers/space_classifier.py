import cv2
import numpy as np
from typing import TypedDict

SPACE_PROFILES = {
    "interior_painting": {
        "edge_range": (0.02, 0.15),
        "saturation_max": 80,
        "reflectance_min": 0.0,
        "texture_variance_max": 1500,
    },
    "exterior_painting": {
        "edge_range": (0.08, 0.35),
        "saturation_max": 160,
        "reflectance_min": 0.0,
        "texture_variance_max": 5000,
    },
    "drywall_repair": {
        "edge_range": (0.05, 0.25),
        "saturation_max": 50,
        "reflectance_min": 0.0,
        "texture_variance_max": 800,
    },
    "bathroom_remodel": {
        "edge_range": (0.10, 0.40),
        "saturation_max": 100,
        "reflectance_min": 0.4,
        "texture_variance_max": 3000,
    },
    "kitchen_remodel": {
        "edge_range": (0.10, 0.45),
        "saturation_max": 140,
        "reflectance_min": 0.2,
        "texture_variance_max": 4000,
    },
    "cleaning": {
        "edge_range": (0.15, 0.50),
        "saturation_max": 180,
        "reflectance_min": 0.0,
        "texture_variance_max": 8000,
    },
    "general_carpentry": {
        "edge_range": (0.08, 0.35),
        "saturation_max": 120,
        "reflectance_min": 0.0,
        "texture_variance_max": 4000,
    },
}

CATEGORY_QUESTIONS = {
    "interior_painting": [
        "¿Cuántos m² de pared necesita pintar?",
        "¿Qué tipo de pintura prefiere (mate, satinada, brillante)?",
        "¿Necesita preparación de superficie?",
    ],
    "exterior_painting": [
        "¿Qué altura tiene la fachada?",
        "¿Hay grietas o zonas dañadas visibles?",
        "¿Cuándo fue la última vez que pintó el exterior?",
    ],
    "drywall_repair": [
        "¿Cuántos agujeros o daños hay que reparar?",
        "¿El daño es superficial o estructural?",
        "¿Necesita texturizar después de reparar?",
    ],
    "bathroom_remodel": [
        "¿El baño tiene tina o solo regadera?",
        "¿Va a cambiar la plomería o solo los acabados?",
        "¿Cuántos m² tiene el baño?",
    ],
    "kitchen_remodel": [
        "¿Va a cambiar gabinetes, encimera, o ambos?",
        "¿Incluye trabajo de plomería o electricidad?",
        "¿Cuántos metros lineales de gabinetes tiene?",
    ],
    "cleaning": [
        "¿Es limpieza post-construcción o mantenimiento?",
        "¿Cuántos m² tiene el área a limpiar?",
        "¿Necesita limpieza de ventanas o solo interior?",
    ],
    "general_carpentry": [
        "¿Qué tipo de madera o material prefiere?",
        "¿Es trabajo a medida o instalación de prefabricado?",
        "¿Tiene planos o referencias del diseño?",
    ],
}


class SpaceClassification(TypedDict):
    category: str
    confidence: float
    skipQuestionsAllowed: bool
    categoryScores: dict
    suggestedQuestions: list
    keyFeatures: list


def compute_edge_density(gray: np.ndarray) -> float:
    edges = cv2.Canny(gray, 50, 150)
    return float(np.sum(edges > 0)) / edges.size


def compute_reflectance(gray: np.ndarray) -> float:
    bright_mask = gray > 200
    return float(np.sum(bright_mask)) / bright_mask.size


def compute_saturation_mean(hsv: np.ndarray) -> float:
    return float(hsv[:, :, 1].mean())


def score_space(name: str, edge_density: float, saturation: float, variance: float, reflectance: float) -> float:
    p = SPACE_PROFILES[name]

    e_min, e_max = p["edge_range"]
    edge_score = 1.0 - min(abs(edge_density - (e_min + e_max) / 2) / ((e_max - e_min) / 2 + 1e-9), 1.0)

    sat_score = 1.0 if saturation <= p["saturation_max"] else max(0.0, 1.0 - (saturation - p["saturation_max"]) / 100.0)

    var_max = p["texture_variance_max"]
    var_score = 1.0 if variance <= var_max else max(0.0, 1.0 - (variance - var_max) / var_max)

    ref_score = 1.0 if reflectance >= p["reflectance_min"] else reflectance / (p["reflectance_min"] + 1e-9)

    return edge_score * 0.25 + sat_score * 0.25 + var_score * 0.25 + ref_score * 0.25


def extract_key_features(image: np.ndarray, gray: np.ndarray, hsv: np.ndarray) -> list:
    features = []
    if float(hsv[:, :, 1].mean()) < 40:
        features.append("neutral color palette")
    if float(gray.var()) > 2000:
        features.append("high texture variation")
    bright = float(np.sum(gray > 200)) / gray.size
    if bright > 0.3:
        features.append("high reflectance surface")
    edges = cv2.Canny(gray, 50, 150)
    if float(np.sum(edges > 0)) / edges.size > 0.2:
        features.append("dense edge patterns")
    return features


def classify_space(image: np.ndarray) -> SpaceClassification:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)

    edge_density = compute_edge_density(gray)
    saturation = compute_saturation_mean(hsv)
    variance = float(gray.var())
    reflectance = compute_reflectance(gray)

    scores = {
        name: score_space(name, edge_density, saturation, variance, reflectance)
        for name in SPACE_PROFILES
    }

    best = max(scores, key=lambda k: scores[k])
    confidence = scores[best]
    skip_allowed = confidence >= 0.75

    return SpaceClassification(
        category=best,
        confidence=round(confidence, 3),
        skipQuestionsAllowed=skip_allowed,
        categoryScores={k: round(v, 3) for k, v in scores.items()},
        suggestedQuestions=CATEGORY_QUESTIONS.get(best, []),
        keyFeatures=extract_key_features(image, gray, hsv),
    )
