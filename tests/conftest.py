"""Configuration commune aux tests Air3Dex."""

import sys
from pathlib import Path


# Le code actuel utilise des imports tels que ``from readers...``.
# On ajoute donc src/preprocessing au chemin d'import sans modifier le projet.
PREPROCESSING_DIR = Path(__file__).resolve().parents[1] / "src" / "preprocessing"
sys.path.insert(0, str(PREPROCESSING_DIR))
