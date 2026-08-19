"""Cross-encoder reranking with a local bge-reranker-v2-m3.

The bi-encoder that produced the index never sees a query and a passage at the
same time -- it compresses each into a vector independently and compares the
vectors. A cross-encoder reads the pair together, which is far more accurate
and far too slow to run over a whole corpus. So: retrieve wide with vectors,
rerank narrow with this.

Scores are raw logits, deliberately. Passing them through a sigmoid (the
default in some wrappers) squashes everything toward zero on this model -- a
clearly relevant pair scored 0.007 against 0.000 for an irrelevant one in
testing, which is correct ordering but useless for reading, thresholding or
showing a reviewer. Logits stay spread out and comparable.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np


class Reranker:
    def __init__(self, model_path: Path, device: str = "cpu", max_length: int = 512, batch_size: int = 32):
        if not Path(model_path).is_dir():
            raise FileNotFoundError(
                f"No reranker at {model_path}. Set RERANKER_MODEL_PATH in "
                "demo/.env to the bge-reranker-v2-m3 directory."
            )
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self._torch = torch
        self.device = device
        self.max_length = max_length
        self.batch_size = batch_size
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_path))

        # Half precision on GPU, and stream the weights in rather than
        # materialising a full float32 copy in host RAM first. Loading this
        # model at float32 while the embedder is already resident exhausts the
        # Windows paging file on a nearly-full disk -- and a reranker only has
        # to order candidates, so the precision is not missed.
        kwargs: dict[str, object] = {"low_cpu_mem_usage": True}
        if device.startswith("cuda"):
            kwargs["dtype"] = torch.float16
        try:
            self.model = AutoModelForSequenceClassification.from_pretrained(str(model_path), **kwargs)
        except TypeError:
            # transformers < 5 spelled it torch_dtype.
            if "dtype" in kwargs:
                kwargs["torch_dtype"] = kwargs.pop("dtype")
            self.model = AutoModelForSequenceClassification.from_pretrained(str(model_path), **kwargs)
        self.model.to(device).eval()

    def score(self, query: str, passages: list[str]) -> np.ndarray:
        if not passages:
            return np.zeros((0,), dtype=np.float32)
        torch = self._torch
        out: list[float] = []
        with torch.no_grad():
            for start in range(0, len(passages), self.batch_size):
                batch = passages[start : start + self.batch_size]
                encoded = self.tokenizer(
                    [query] * len(batch),
                    batch,
                    padding=True,
                    truncation=True,
                    max_length=self.max_length,
                    return_tensors="pt",
                ).to(self.device)
                logits = self.model(**encoded, return_dict=True).logits.view(-1).float()
                out.extend(logits.cpu().tolist())
        return np.asarray(out, dtype=np.float32)

    @staticmethod
    def to_probability(logits: np.ndarray) -> np.ndarray:
        """Sigmoid, for display only. Never rank on this."""
        return 1.0 / (1.0 + np.exp(-logits))
