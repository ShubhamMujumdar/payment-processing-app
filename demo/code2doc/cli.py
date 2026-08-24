"""Command line.

    python -m code2doc.cli ingest [--source confluence|local]
    python -m code2doc.cli index
    python -m code2doc.cli search "text to look up" [--top-k 5] [--no-rerank]
    python -m code2doc.cli stats
    python -m code2doc.cli serve
    python -m code2doc.cli probe          check Confluence credentials and access
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import Any

from .chunking import chunk_pages
from .config import config
from .ingest import ingest, load_pages
from .store import VectorStore


def cmd_ingest(args: argparse.Namespace) -> int:
    cfg = config()
    pages = ingest(cfg, args.source)
    print(f"ingested {len(pages)} pages from {args.source} -> {cfg.docs_dir}")
    for page in pages:
        print(f"  {page.page_id:24} {page.title[:52]:54} {len(page.markdown):>7} chars")
    if not pages:
        print("  (nothing returned - check the space key and that the account can see it)")
    return 0


def cmd_index(args: argparse.Namespace) -> int:
    from .embedding import Embedder

    cfg = config()
    pages = load_pages(cfg)
    if not pages:
        print("Nothing in demo/docs. Run `ingest` first.")
        return 1

    # The embedder loads first because the chunker needs its tokeniser: the
    # budget is in tokens, and estimating tokens from characters truncated a
    # fifth of this corpus.
    device = cfg.resolved_device()
    start = time.perf_counter()
    embedder = Embedder(cfg.embedding_model, device=device)
    print(f"loaded {cfg.embedding_model.name} on {device} in {time.perf_counter() - start:.1f}s")

    chunks = chunk_pages(pages, token_counter=embedder.token_count)
    print(f"{len(pages)} pages -> {len(chunks)} chunks")

    texts = [c.embed_text() for c in chunks]
    truncated = embedder.count_truncated(texts)
    if truncated:
        print(f"  WARNING: {truncated} chunks still exceed {embedder.max_seq_length} tokens")
    else:
        print(f"  no chunk exceeds {embedder.max_seq_length} tokens")

    start = time.perf_counter()
    vectors = embedder.embed_passages(texts, show_progress=True)
    elapsed = time.perf_counter() - start
    print(f"embedded {len(vectors)} chunks in {elapsed:.1f}s ({len(vectors) / max(elapsed, 1e-9):.0f}/s)")

    store = VectorStore(cfg.data_dir)
    store.replace(
        chunks,
        vectors,
        meta={
            "embedding_model": cfg.embedding_model.name,
            "dimension": int(vectors.shape[1]),
            "built_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "truncated_chunks": truncated,
        },
    )
    print(f"index written to {store.directory}")
    return 0


def cmd_search(args: argparse.Namespace) -> int:
    from .retrieve import Retriever

    cfg = config()
    retriever = Retriever(cfg, load_reranker=not args.no_rerank)
    response = retriever.search(
        args.query, top_k=args.top_k, rerank=not args.no_rerank
    )
    print(f"\nquery: {response.query}")
    print(f"timing: {', '.join(f'{k} {v:.0f}ms' for k, v in response.timing_ms.items())}\n")
    for result in response.results:
        score = (
            f"rerank {result.rerank_score:+.3f}  vector {result.vector_score:.3f}"
            if result.rerank_score is not None
            else f"vector {result.vector_score:.3f}"
        )
        print(f"{result.rank}. {score}")
        print(f"   {result.location}")
        print(f"   {result.anchor_url}")
        snippet = " ".join(result.text.split())[:200]
        print(f"   {snippet}...\n")
    if not response.results:
        print("(no results)")
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    cfg = config()
    store = VectorStore(cfg.data_dir)
    stats = store.stats()
    print(f"index: {store.directory}")
    for key, value in stats.items():
        print(f"  {key:20} {value}")
    if stats.get("built"):
        print("\npages:")
        for page in store.pages():
            print(f"  {page['chunks']:>4} chunks  {page['page_title'][:60]}")
    return 0


def cmd_probe(args: argparse.Namespace) -> int:
    """Check credentials and access without indexing anything."""
    from .sources.confluence import ConfluenceClient, ConfluenceError

    cfg = config()
    if not cfg.has_confluence:
        print("No Confluence credentials in demo/.env.")
        print("  CONFLUENCE_BASE_URL  ", cfg.base_url or "(unset)")
        print("  CONFLUENCE_EMAIL     ", cfg.email or "(unset)")
        print("  CONFLUENCE_API_TOKEN ", "set" if cfg.api_token else "(unset)")
        return 1
    client = ConfluenceClient(cfg.base_url, cfg.email, cfg.api_token, cfg.space_key)
    try:
        space_id = client.space_id()
        print(f"authenticated as {cfg.email}")
        print(f"space {cfg.space_key} -> id {space_id}")
        pages = client.pages()
        print(f"{len(pages)} pages visible:")
        for page in pages:
            print(f"  {page.page_id:>12}  v{page.version:<3} {page.title[:60]}")
            print(f"                {page.url}")
    except ConfluenceError as exc:
        print(f"FAILED: {exc}")
        return 1
    finally:
        client.close()
    return 0


def cmd_analyze(args: argparse.Namespace) -> int:
    """The whole loop: a diff in, proposed documentation edits out."""
    import subprocess

    from .analyze import analyse_change, propose_redline
    from .retrieve import Retriever

    cfg = config()  # loads .env, so ANTHROPIC_API_KEY is present for the SDK

    if args.file:
        diff = open(args.file, encoding="utf-8").read()
    elif args.git:
        diff = subprocess.run(
            ["git", "-C", args.repo, "diff", args.git],
            capture_output=True, text=True, check=True,
        ).stdout
    else:
        diff = sys.stdin.read()
    if not diff.strip():
        print("No diff supplied. Use --file, --git <range>, or pipe one in.")
        return 1

    print("analysing change…")
    analysis = analyse_change(diff)
    print(f"  summary : {analysis.summary}")
    print(f"  kind    : {analysis.change_kind}")
    if not analysis.doc_impact_expected:
        print("\nNo documentation impact expected for this kind of change. Stopping.")
        return 0

    retriever = Retriever(cfg)
    seen: dict[str, Any] = {}
    for query in analysis.queries:
        print(f"\n  query   : {query.topic}")
        print(f"            {query.rationale}")
        for result in retriever.search(query.topic, top_k=args.top_k, candidates=20).results:
            # Keep the best score a section earned under any query: one probe
            # matching strongly is the signal, not the average across probes.
            key = f"{result.page_id}:{result.char_start}"
            if key not in seen or result.rerank_score > seen[key].rerank_score:
                seen[key] = result

    ranked = sorted(seen.values(), key=lambda r: -(r.rerank_score or 0))[: args.top_k]
    if not ranked:
        print("\nNothing retrieved.")
        return 0

    print(f"\n{'=' * 72}\nproposed documentation changes\n{'=' * 72}")
    for result in ranked:
        print(f"\n{result.page_title}  >  {result.heading_path}")
        print(f"  rerank {result.rerank_score:+.3f}   lines {result.line_start}-{result.line_end}")
        print(f"  {result.anchor_url}")
        redline = propose_redline(diff, result.location, result.text, analysis.summary)
        if not redline.needs_change:
            print(f"  -> no change needed: {redline.rationale}")
            continue
        print(f"  -> confidence {redline.confidence}: {redline.rationale}")
        print(f"     citation: {redline.code_citation}")
        for line in redline.existing_text.splitlines():
            print(f"     - {line}")
        for line in redline.proposed_text.splitlines():
            print(f"     + {line}")
    return 0


def cmd_watch(args: argparse.Namespace) -> int:
    """Poll a branch and run the pipeline on every new commit."""
    from .retrieve import Retriever
    from .watcher import Watcher

    cfg = config()
    if not cfg.has_github:
        print("No GITHUB_TOKEN / GITHUB_REPO. Add them to demo/.env (or dashboard/.env).")
        return 1

    print(f"loading models on {cfg.resolved_device()}…")
    watcher = Watcher(cfg, Retriever(cfg), top_k=args.top_k, branch=args.branch)
    try:
        if args.once:
            run_id = watcher.poll_once()
            print(run_id or "no new commit")
        else:
            watcher.run_forever()
    except KeyboardInterrupt:
        print("\nstopped")
    finally:
        watcher.close()
    return 0


def cmd_replay(args: argparse.Namespace) -> int:
    """Run the pipeline on a commit that already exists.

    Rehearsal without pushing: the demo can be practised end to end against a
    real commit as many times as needed.
    """
    from .changes import from_github_commit
    from .retrieve import Retriever
    from .watcher import Watcher

    cfg = config()
    if not cfg.has_github:
        print("No GITHUB_TOKEN / GITHUB_REPO configured.")
        return 1

    watcher = Watcher(cfg, Retriever(cfg), top_k=args.top_k)
    try:
        payload = watcher.source.commit(args.sha)
        change = from_github_commit(payload, args.branch, watcher.source.repo_url())
        if args.force:
            # A replay of an already-processed commit would otherwise be a
            # no-op, which is exactly wrong when rehearsing.
            with watcher.store._connect() as conn:
                conn.execute("DELETE FROM runs WHERE sha = ?", (change.sha,))
        run_id = watcher.process(change)
        run = watcher.store.get(run_id)
        print(f"\nrun {run_id}: {run['status']}")
        for proposal in run.get("proposals") or []:
            if not proposal["needs_change"]:
                continue
            print(f"\n  {proposal['page_title']} > {proposal['heading_path']}")
            print(f"  {proposal['anchor_url']}")
            for line in proposal["existing_text"].splitlines():
                print(f"    - {line}")
            for line in proposal["proposed_text"].splitlines():
                print(f"    + {line}")
    finally:
        watcher.close()
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    import os

    import uvicorn

    cfg = config()
    if args.watch:
        # Read by the API's lifespan, which starts the watcher in-process so the
        # models are loaded once rather than once per process.
        os.environ["WATCH_ON_SERVE"] = "1"
    print(f"code2doc API   http://127.0.0.1:{cfg.api_port}")
    print(f"docs           http://127.0.0.1:{cfg.api_port}/docs")
    print(f"events (SSE)   http://127.0.0.1:{cfg.api_port}/stream")
    if args.watch:
        # Deliberately not "watching ..." here. Whether the watcher actually
        # starts is decided in the API's lifespan, which prints the truth once
        # it knows. Announcing it from here printed a reassuring line even when
        # no credential was present and nothing was ever polled.
        print(f"watch requested  {cfg.github_repo}@{cfg.watch_branch}")
    uvicorn.run("code2doc.api:app", host="127.0.0.1", port=cfg.api_port, reload=False)
    return 0


def main() -> int:
    # Windows consoles default to cp1252, and the documentation contains
    # characters it cannot encode. Printing a search result should not be able
    # to crash the search.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(prog="code2doc", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("ingest", help="fetch pages into demo/docs")
    p.add_argument("--source", default="confluence", choices=["confluence", "local"])
    p.set_defaults(func=cmd_ingest)

    p = sub.add_parser("index", help="chunk, embed and store")
    p.set_defaults(func=cmd_index)

    p = sub.add_parser("search", help="query the index from the terminal")
    p.add_argument("query")
    p.add_argument("--top-k", type=int, default=5)
    p.add_argument("--no-rerank", action="store_true", help="show raw bi-encoder ordering")
    p.set_defaults(func=cmd_search)

    p = sub.add_parser("stats", help="what is indexed")
    p.set_defaults(func=cmd_stats)

    p = sub.add_parser("probe", help="check Confluence credentials and access")
    p.set_defaults(func=cmd_probe)

    p = sub.add_parser("analyze", help="diff in, proposed documentation edits out")
    p.add_argument("--file", help="read the diff from a file")
    p.add_argument("--git", help="a git range, e.g. HEAD~1..HEAD")
    p.add_argument("--repo", default=".", help="repository for --git")
    p.add_argument("--top-k", type=int, default=3)
    p.set_defaults(func=cmd_analyze)

    p = sub.add_parser("watch", help="poll a branch and analyse every new commit")
    p.add_argument("--branch", help="override WATCH_BRANCH")
    p.add_argument("--once", action="store_true", help="single poll, then exit")
    p.add_argument("--top-k", type=int, default=3)
    p.set_defaults(func=cmd_watch)

    p = sub.add_parser("replay", help="run the pipeline on an existing commit (rehearsal)")
    p.add_argument("sha")
    p.add_argument("--branch", default="development")
    p.add_argument("--force", action="store_true", help="re-run even if already processed")
    p.add_argument("--top-k", type=int, default=3)
    p.set_defaults(func=cmd_replay)

    p = sub.add_parser("serve", help="run the API")
    p.add_argument("--watch", action="store_true", help="also watch the branch, in the same process")
    p.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
