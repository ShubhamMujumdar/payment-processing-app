"""Dense embeddings from a local bge-large-en-v1.5.

Loaded from disk with the Hugging Face hub disabled, so this never reaches the
network and never re-downloads 1.3GB of weights that are already present.

The asymmetry matters: bge-*-en-v1.5 was trained with an instruction prefix on
the *query* side only. Embedding passages with the same prefix, or queries
without it, measurably degrades retrieval -- and does so silently, which is the
worst failure mode available. The two methods below exist so that distinction
cannot be got wrong by a caller.
"""

from __future__ import annotations

import os
from pathlib import Path

import numpy as np

#: Prescribed by the model card for short-query / long-passage retrieval.
QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


class Embedder:
    def __init__(self, model_path: Path, device: str = "cpu", batch_size: int = 16):
        if not Path(model_path).is_dir():
            raise FileNotFoundError(
                f"No embedding model at {model_path}. Set EMBEDDING_MODEL_PATH "
                "in demo/.env to the bge-large-en-v1.5 directory."
            )
        os.environ.setdefault("HF_HUB_OFFLINE", "1")
        os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

        from sentence_transformers import SentenceTransformer

        self.model_path = Path(model_path)
        self.device = device
        self.batch_size = batch_size
        self.model = SentenceTransformer(str(model_path), device=device)
        self.max_seq_length = int(self.model.max_seq_length)

    @property
    def dimension(self) -> int:
        return int(self.model.get_sentence_embedding_dimension())

    def embed_passages(self, texts: list[str], show_progress: bool = False) -> np.ndarray:
        """Documents. No instruction prefix."""
        if not texts:
            return np.zeros((0, self.dimension), dtype=np.float32)
        vectors = self.model.encode(
            texts,
            batch_size=self.batch_size,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=show_progress,
        )
        return np.asarray(vectors, dtype=np.float32)

    def embed_query(self, text: str) -> np.ndarray:
        """A single query. Instruction prefix applied."""
        vector = self.model.encode(
            QUERY_INSTRUCTION + text,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return np.asarray(vector, dtype=np.float32)

    def token_count(self, text: str) -> int:
        """Exact token length, for the chunker's budget.

        Measuring deliberately over-long text is the whole point here, so the
        tokeniser's "longer than the maximum sequence length" warning is noise
        -- and worse, it claims an indexing error that does not happen, because
        the caller is about to split on this number.
        """
        import transformers

        verbosity = transformers.logging.get_verbosity()
        transformers.logging.set_verbosity_error()
        try:
            return len(self.model.tokenizer.encode(text, add_special_tokens=True))
        finally:
            transformers.logging.set_verbosity(verbosity)

    def count_truncated(self, texts: list[str]) -> int:
        """How many texts the model will silently cut off.

        Worth surfacing at index time: a truncated chunk is indexed under an
        embedding of its first half only, and nothing later in the pipeline can
        tell that happened.
        """
        tokenizer = self.model.tokenizer
        over = 0
        for text in texts:
            if len(tokenizer.encode(text, add_special_tokens=True)) > self.max_seq_length:
                over += 1
        return over
