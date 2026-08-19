"""The vector database: Chroma, persisted to demo/data.

Chroma holds the vectors, the chunk text and the metadata in one store, so
there is a single named component to point at rather than an index beside a
separate metadata table. (FAISS would have meant exactly that split -- it is an
index and nothing else.)

Distances come back as cosine distance and are converted to similarity here, so
everything above this layer deals in "1.0 is identical" like the reranker does.
Embeddings are supplied already computed: Chroma will happily download its own
default embedding model otherwise, which would silently index the corpus with a
different model from the one queries are embedded with.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np

from .chunking import Chunk

COLLECTION = "documentation"
#: Chroma rejects very large single writes; this stays well inside every limit.
BATCH = 500

#: Chroma metadata accepts only scalars, and the chunk body belongs in the
#: document field rather than duplicated into metadata.
_META_FIELDS = [
    "chunk_id", "page_id", "page_title", "url", "anchor_url", "source",
    "space_key", "page_version", "page_last_updated", "heading",
    "heading_path", "level", "ordinal", "char_start", "char_end",
    "line_start", "line_end",
]


@dataclass
class Hit:
    row: int
    score: float
    chunk: dict[str, Any]


def _scalar(value: Any) -> str | int | float | bool:
    """Chroma stores scalars only, and rejects None outright."""
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


class VectorStore:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self._client: Any = None
        self._meta_path = self.directory / "index-meta.json"

    # --- lifecycle ---------------------------------------------------------
    @property
    def client(self) -> Any:
        if self._client is None:
            import chromadb
            from chromadb.config import Settings

            self._client = chromadb.PersistentClient(
                path=str(self.directory),
                settings=Settings(anonymized_telemetry=False, allow_reset=True),
            )
        return self._client

    def collection(self, create: bool = False) -> Any:
        if create:
            return self.client.get_or_create_collection(
                name=COLLECTION,
                # Set at creation: Chroma cannot change the metric afterwards,
                # and the default is L2, which is wrong for normalised vectors.
                metadata={"hnsw:space": "cosine"},
            )
        return self.client.get_collection(name=COLLECTION)

    @property
    def is_built(self) -> bool:
        try:
            return self.collection().count() > 0
        except Exception:
            return False

    # --- write -------------------------------------------------------------
    def replace(self, chunks: list[Chunk], vectors: np.ndarray, meta: dict[str, Any] | None = None) -> int:
        """Rebuild the collection wholesale.

        Incremental update is deliberately absent: the corpus re-embeds in
        seconds, and a partial index that disagrees with the source costs far
        more to debug than a rebuild costs to run.
        """
        if len(chunks) != len(vectors):
            raise ValueError(f"{len(chunks)} chunks but {len(vectors)} vectors")

        vectors = np.ascontiguousarray(vectors, dtype=np.float32)
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vectors = vectors / norms

        try:
            self.client.delete_collection(name=COLLECTION)
        except Exception:
            pass  # first build
        collection = self.collection(create=True)

        for start in range(0, len(chunks), BATCH):
            window = chunks[start : start + BATCH]
            collection.add(
                # Position is part of the id because two chunks of one page can
                # share a content hash (repeated boilerplate), and Chroma
                # silently keeps only the last write for a duplicate id.
                ids=[f"{c.chunk_id}-{start + i}" for i, c in enumerate(window)],
                embeddings=[v.tolist() for v in vectors[start : start + BATCH]],
                documents=[c.text for c in window],
                metadatas=[
                    {k: _scalar(c.to_row()[k]) for k in _META_FIELDS} for c in window
                ],
            )

        self._meta_path.write_text(
            json.dumps({**(meta or {}), "chunks": len(chunks)}, indent=2), encoding="utf-8"
        )
        return len(chunks)

    # --- read --------------------------------------------------------------
    def search(self, query_vector: np.ndarray, k: int = 30) -> list[Hit]:
        collection = self.collection()
        query = np.asarray(query_vector, dtype=np.float32).reshape(-1)
        result = collection.query(
            query_embeddings=[query.tolist()],
            n_results=min(k, max(collection.count(), 1)),
            include=["metadatas", "documents", "distances"],
        )

        hits: list[Hit] = []
        ids = result.get("ids", [[]])[0]
        for index, chunk_id in enumerate(ids):
            metadata = dict(result["metadatas"][0][index] or {})
            metadata["text"] = result["documents"][0][index] or ""
            distance = float(result["distances"][0][index])
            hits.append(
                # Chroma reports cosine *distance*; everything above this layer
                # reads scores as "higher is closer".
                Hit(row=index, score=1.0 - distance, chunk=metadata)
            )
        return hits

    def fetch(self, rows: Iterable[int]) -> dict[int, dict[str, Any]]:
        """Present for interface compatibility. Chroma returns metadata and
        documents on the query itself, so search never needs a second lookup."""
        return {}

    def stats(self) -> dict[str, Any]:
        try:
            count = self.collection().count()
        except Exception:
            return {"built": False, "chunks": 0, "pages": 0, "backend": "chroma"}
        meta = {}
        if self._meta_path.exists():
            meta = json.loads(self._meta_path.read_text(encoding="utf-8"))
        return {
            "built": count > 0,
            "backend": "chroma",
            "collection": COLLECTION,
            "chunks": count,
            "pages": len({p["page_id"] for p in self._all_metadata()}),
            **meta,
        }

    def _all_metadata(self) -> list[dict[str, Any]]:
        try:
            got = self.collection().get(include=["metadatas"])
        except Exception:
            return []
        return [dict(m or {}) for m in got.get("metadatas", [])]

    def pages(self) -> list[dict[str, Any]]:
        grouped: dict[str, dict[str, Any]] = {}
        for metadata in self._all_metadata():
            page_id = str(metadata.get("page_id", ""))
            entry = grouped.setdefault(
                page_id,
                {
                    "page_id": page_id,
                    "page_title": metadata.get("page_title", ""),
                    "url": metadata.get("url", ""),
                    "source": metadata.get("source", ""),
                    "page_version": metadata.get("page_version", 0),
                    "page_last_updated": metadata.get("page_last_updated", ""),
                    "chunks": 0,
                },
            )
            entry["chunks"] += 1
        return sorted(grouped.values(), key=lambda p: str(p["page_title"]))
