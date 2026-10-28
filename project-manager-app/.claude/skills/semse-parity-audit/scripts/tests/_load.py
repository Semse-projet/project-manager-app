"""Load a tool from this skill's scripts/ folder.

Adapted from replica-skill's tests/_load.py: upstream kept one folder per
skill (replica-diff/, replica-design/...); each SEMSE kit skill keeps its own
tools in its scripts/, so `folder` is accepted for upstream test compatibility
and ignored. ROOT is the skill folder (semse-parity-audit/).
"""

import importlib.util
import os

SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(SCRIPTS)


def load(folder, name):
    path = os.path.join(SCRIPTS, name + ".py")
    spec = importlib.util.spec_from_file_location("semse_parity_" + name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod
