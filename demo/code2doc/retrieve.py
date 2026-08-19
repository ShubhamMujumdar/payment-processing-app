"""Two-stage retrieval: embed wide, rerank narrow.

Both scores travel all the way to the response on purpose. When a result is
wrong, the pair of numbers says which stage got it wrong -- a high vector score
with a low rerank score means the bi-encoder was fooled by vocabulary overlap;
both low means the section simply is not in the index. Reporting a single
blended "confidence" would destroy exactly the information needed to fix it.

Models are loaded once and held. The reranker is the expensive one to load
(~17s) and both together sit at ~3.6GB of VRAM, which fits the 6GB card with
room to spare, so there is nothing to gain from unloading between calls.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from .config import Config
from .embedding import Embedder
from .reranking import Reranker
from .store import VectorStore

#: How many candidates the vector stage hands the reranker. Wider is better for
#: recall and costs ~10ms per extra candidate on GPU; 30 comfortably covers a
#: corpus this size.
DEFAULT_CANDIDATES = 30
DEFAULT_TOP_K = 5


@dataclass
class Result:
    rank: int
    chunk_id: str
    page_id: str
    page_title: str
    heading: str
    heading_path: str
    location: str
    url: str
    anchor_url: str
    source: str
    page_version: int
    page_last_updated: str
    line_start: int
    line_end: int
    char_start: int
    char_end: int
    text: str
    vector_score: float
    rerank_score: float | None
    rerank_probability: float | None

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


@dataclass
class SearchResponse:
    query: str
    results: list[Result]
    candidates_considered: int
    reranked: bool
    timing_ms: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "reranked": self.reranked,
            "candidates_considered": self.candidates_considered,
            "count": len(self.results),
            "timing_ms": {k: round(v, 1) for k, v in self.timing_ms.items()},
            "results": [r.to_dict() for r in self.results],
        }


class Retriever:
    def __init__(self, config: Config, load_reranker: bool = True):
        self.config = config
        self.device = config.resolved_device()
        self.store = VectorStore(config.data_dir)
        self.embedder = Embedder(config.embedding_model, device=self.device)
        self.reranker: Reranker | None = None
        if load_reranker:
            self.reranker = Reranker(config.reranker_model, device=self.device)

    def ensure_reranker(self) -> Reranker:
        if self.reranker is None:
            self.reranker = Reranker(self.config.reranker_model, device=self.device)
        return self.reranker

    def search(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        candidates: int = DEFAULT_CANDIDATES,
        rerank: bool = True,
        min_rerank_score: float | None = None,
    ) -> SearchResponse:
        timing: dict[str, float] = {}

        start = time.perf_counter()
        vector = self.embedder.embed_query(query)
        timing["embed"] = (time.perf_counter() - start) * 1000

        start = time.perf_counter()
        hits = self.store.search(vector, k=max(candidates, top_k))
        timing["vector_search"] = (time.perf_counter() - start) * 1000

        rerank_scores: list[float | None] = [None] * len(hits)
        if rerank and hits:
            start = time.perf_counter()
            scores = self.ensure_reranker().score(query, [h.chunk["text"] for h in hits])
            timing["rerank"] = (time.perf_counter() - start) * 1000
            order = sorted(range(len(hits)), key=lambda i: -scores[i])
            hits = [hits[i] for i in order]
            rerank_scores = [float(scores[i]) for i in order]

        results: list[Result] = []
        for rank, (hit, rerank_score) in enumerate(zip(hits, rerank_scores), start=1):
            if min_rerank_score is not None and rerank_score is not None and rerank_score < min_rerank_score:
                continue
            chunk = hit.chunk
            trail = chunk.get("heading_path") or "(top of page)"
            results.append(
                Result(
                    rank=len(results) + 1,
                    chunk_id=chunk["chunk_id"],
                    page_id=chunk["page_id"],
                    page_title=chunk["page_title"],
                    heading=chunk["heading"] or "",
                    heading_path=trail,
                    location=(
                        f"{chunk['page_title']} :: {trail} "
                        f"(lines {chunk['line_start']}-{chunk['line_end']})"
                    ),
                    url=chunk["url"],
                    anchor_url=chunk["anchor_url"],
                    source=chunk["source"],
                    page_version=chunk["page_version"],
                    page_last_updated=chunk["page_last_updated"] or "",
                    line_start=chunk["line_start"],
                    line_end=chunk["line_end"],
                    char_start=chunk["char_start"],
                    char_end=chunk["char_end"],
                    text=chunk["text"],
                    vector_score=round(hit.score, 4),
                    rerank_score=round(rerank_score, 4) if rerank_score is not None else None,
                    rerank_probability=(
                        round(float(Reranker.to_probability(np.array([rerank_score]))[0]), 4)
                        if rerank_score is not None
                        else None
                    ),
                )
            )
            if len(results) >= top_k:
                break

        return SearchResponse(
            query=query,
            results=results,
            candidates_considered=len(hits),
            reranked=bool(rerank and hits),
            timing_ms=timing,
        )
