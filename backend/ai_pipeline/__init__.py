"""
MedScribeAI backend AI pipeline (extracted from Colab SOAP_Pipeline.ipynb process_audio).

Not wired into main.py yet. Public entry: run_pipeline.
"""

from .pipeline import run_pipeline

__all__ = ["run_pipeline"]
