# code2doc — retrieval

Given text describing a code change, return the documentation sections it
impacts, and where in those documents they sit.

This is the retrieval half of the code-to-doc loop. The git trigger, the LLM
redline and the review UI attach to it later; all of them depend on this
answering correctly, so it is built to be inspected rather than trusted.

```
Confluence ──ingest──> demo/docs ──chunk──> embed ──> demo/data (vector index)
                                                          │
                        query ──embed──> vector search ──rerank──> /impact
```

## Setup

Models are loaded from `../embedding/` and nothing is ever downloaded
(`HF_HUB_OFFLINE` is set in-process).

```bash
cd demo
pip install -r requirements.txt      # torch/sentence-transformers already present
cp .env.example .env                 # then fill in the Confluence values
```

## Commands

```bash
python -m code2doc.cli probe                        # check Confluence credentials and access
python -m code2doc.cli ingest --source confluence   # or --source local
python -m code2doc.cli index                        # chunk, embed, store
python -m code2doc.cli search "some text"           # query from the terminal
python -m code2doc.cli analyze --git HEAD~1..HEAD --repo ../app_src
python -m code2doc.cli stats                        # what is indexed
python -m code2doc.cli serve                        # API on http://127.0.0.1:8099
```

`analyze` is the whole loop: it sends the diff to Claude Opus 5 for topic-shaped
retrieval queries, searches, then asks for a minimal redline against each
retrieved section — and is told that declining to edit is a valid answer.

### Watching a branch

```bash
python -m code2doc.cli watch                    # poll and analyse every new commit
python -m code2doc.cli watch --once             # single poll, then exit
python -m code2doc.cli replay <sha> --force     # re-run a past commit (rehearsal)
```

`watch` polls GitHub every `POLL_SECONDS` (default 3). **Polling, not webhooks** —
a webhook needs a public HTTPS URL, which on a laptop means a tunnel: a second
moving part that can fail mid-demo. One poll is a single API call
against a 5000/hour budget, so a 3-second interval uses ~1200/hour and still
leaves room.

`replay` is what makes the demo rehearsable: run the pipeline against a real
commit as many times as you like without pushing anything.

Each commit produces a run and a stream of events in `demo/data/runs.sqlite`:

```
detected -> analysing -> retrieving -> retrieved -> proposed
                                                \-> no-impact
                                                 \-> failed
```

Events are written *before* each stage starts, so a dashboard can show
"analysing" while the model is still thinking rather than a gap followed by a
finished result.

### Noise filtering

`changes.py` drops lock files, build output, binaries and formatting-only edits
before anything reaches the model — a lock file diff can be thousands of lines
and was never going to change prose. The bar is deliberately high: a rule only
fires when the change *cannot* make documentation stale. Anything uncertain
goes to the model, which is allowed to answer "no documentation impact".

Measured on two real commits, both CI-config changes: the pipeline classified
both as `configuration`, retrieved plausible "Configuration" and "Workflows"
sections, and then **declined to edit all six** — with reasons. Finding a
plausible section and still saying no is the behaviour that makes the rest
trustworthy.

`--source local` indexes the four Confluence-format requirement documents in
`../docs/requirements`. It needs no credentials, which is what makes the
pipeline testable before a token exists and repeatable without the network
afterwards.

## API

`POST /impact`

```json
{ "text": "...", "top_k": 5, "candidates": 30, "rerank": true, "min_rerank_score": null }
```

Each result carries its location and both scores:

| Field | Meaning |
|---|---|
| `page_title`, `heading_path` | where in the corpus |
| `line_start` / `line_end`, `char_start` / `char_end` | where in the page |
| `anchor_url` | deep link to the section |
| `vector_score` | cosine, 0–1. What the bi-encoder thought |
| `rerank_score` | cross-encoder logit. Signed; **negative means "not really about this"** |
| `rerank_probability` | sigmoid of the above, for display only — never rank on it |

Also `GET /health`, `GET /stats`, `GET /pages`, and OpenAPI at `/docs`.

## Two things worth knowing before building on this

**Both scores are reported because they disagree, and the disagreement is the
signal.** The bi-encoder compresses query and passage into vectors separately;
the cross-encoder reads them together. When a result has a high vector score
and a negative rerank score, the vector stage was fooled by shared vocabulary.
Blending them into one "confidence" number would throw away the only
diagnostic available.

**Query phrasing dominates everything else.** Scoring the same target section
against the same distractor, varying only how the query is worded:

| Query form | Target | Margin over distractor |
|---|---|---|
| Statement about the change | **−2.779** | 8.25 |
| Raw `git diff` | −0.747 | 6.59 |
| Question the doc answers | +0.544 | 11.54 |
| Question naming the entity | +1.548 | 12.24 |
| **Topic / noun phrase** | **+2.965** | **13.69** |

A 5.7 logit swing from phrasing alone, on identical content. The reason is that
a cross-encoder scores *"does this passage answer this query"*, and
documentation states what a system **is** — it never narrates changes. So a
query describing an edit scores badly against the very section that documents
the thing being edited.

**The consequence for the agent: query the subject matter, never the change.**
That is what `analyze.py` does, and it is why the correct section comes back at
+2.65 rather than −2.78.

Two warnings about thresholds. First, absolute rerank scores are **not portable
between corpora** — an earlier measurement on a different, prose-heavy corpus
put a well-formed query at +4.06 where this one sits at +2.97. Calibrate per
corpus; never hard-code a number from someone else's. Second, what is reliable
is **ranking and the margin**, not the absolute value.

## Design notes

**The vector store is Chroma**, persisted to `demo/data`, holding vectors, chunk
text and metadata in one component. FAISS was the alternative and was rejected
because it is an index and nothing else — it would have needed a separate
metadata store beside it. Embeddings are always supplied pre-computed: left to
itself Chroma downloads its own default embedding model, which would index the
corpus with a different model from the one embedding the queries, and nothing
would report the mismatch.

**Chunks split on headings, not a sliding window.** A heading is a boundary the
author chose and has a name, so a citation points at something a reviewer
recognises. Every chunk records its heading path, character range and line
range — that is what makes "what part of the document" a location.

**The token budget is counted, not estimated.** These documents are dense with
tables and identifiers like `FR-PAY-043` and tokenise at ~2.1 chars/token, not
the ~4 typical of prose. A character-based budget tuned on prose silently
truncated 22% of the corpus — chunks indexed on their first half only, with
nothing downstream able to tell.

**The reranker runs in fp16.** Loading it at fp32 while the embedder is already
resident exhausts the Windows paging file on a nearly-full disk. A reranker
only has to order candidates; the precision is not missed.

## Performance (RTX 3060 Laptop, 6GB)

| | |
|---|---|
| Model load, once at startup | ~21s (embedder 13s + reranker 8s) |
| VRAM, both resident | ~2.5 GB fp16 |
| Index build, 5 pages → 295 chunks | ~19s |
| Query: embed | ~27 ms |
| Query: vector search over 295 chunks | ~3 ms |
| Query: rerank 30 candidates | ~880 ms |

Rerank dominates and is compute-bound — batching barely moves it. Lower
`candidates` to trade recall for latency: 15 candidates roughly halves it.

## Confluence read/write

`sources/confluence.py` speaks REST API v2 with HTTP Basic (account email +
API token). Reads follow v2 cursor pagination. Writes go through
`update_page`, which **raises unless passed `confirm=True`** — an accidental
write into a shared team space is not undone by re-running anything. Use
`dry_run_update` to see the before/after first.

Writes edit the page's original **storage format**, never Markdown
round-tripped back. The Markdown here is lossy by design — it exists so the
chunker can see heading structure. Converting it back would destroy every
macro, layout and table style on the page.

Version numbers are sent as `current + 1`, which is how Confluence does
optimistic concurrency: if someone saved while we were thinking, the write is
rejected with a 409 rather than silently overwriting them.

### Publishing an approved redline

`POST /runs/{id}/proposals/{n}/publish` with `{"dry_run": true}` plans the edit
and returns it; `false` performs it. The dashboard always calls the first before
enabling the second — the proposal was drafted against a snapshot, and the plan
is the only cheap moment to notice the page has moved since.

**The redline is Markdown; the page is XHTML storage format.** They do not
correspond line for line, so the approved text cannot be written over the page
body. Converting the section back to storage format would rewrite markup nobody
proposed changing — macros, layouts, column widths.

Instead `publish.py` narrows the edit to the smallest text that actually
changed (for a table row, a single cell: `Minimum 0.01` → `Minimum 1.00`),
proves that string is unique, and replaces only it.

**The replacement is done on the raw string, never on a parsed tree.** Measured
on this space, a BeautifulSoup round trip of *untouched* storage format is not
lossless:

| Parser | Result on a 9,307-char page |
|---|---|
| `lxml-xml` | collapses to **147 chars** — storage format uses undeclared namespaces |
| `html.parser` | reorders attributes, drops whitespace, rewrites `<p />` as `<p></p>` |

Editing the raw string leaves the document byte-identical apart from the
fragment. Verified: 9,792 chars in, 9,792 out, one changed region.

Three refusals, all deliberate — a refusal is recoverable by re-indexing, a
wrong edit to a shared space is not:

- **fragment not found** — the page changed since the proposal was drafted
- **fragment found more than once** — the target is ambiguous
- **text-node count disagrees with raw count** — the string also occurs inside
  markup, so a raw replacement could land in a tag or attribute

Version numbers are sent as `current + 1`, which is how Confluence does
optimistic concurrency: if someone saved while we were deciding, the write is
rejected with a 409 rather than silently overwriting them.

### Anchors are best-effort

`anchor_for()` generates the Confluence Cloud heading anchor convention, but
Confluence builds these client-side and the rule has changed between editors.
It also cannot be validated over HTTP — a URL fragment is never sent to the
server, so no request can confirm it resolves. **The page URL is always
correct; the anchor may need a scroll.** `heading_path` and the line range are
the reliable location.

## Status

Working: Confluence and local ingestion, heading-aware chunking with positions,
bge-large-en-v1.5 embeddings, exact vector search, bge-reranker-v2-m3
reranking, the `/impact` API, and the Confluence write primitive.

Not built yet: the git trigger, diff-to-query rewriting, LLM redline
generation, and the review UI.
