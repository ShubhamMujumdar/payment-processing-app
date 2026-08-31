---
name: demo_flow
description: Run or reset the code2doc demo — make a semantically real change to the watched Java repo, commit and push it to `development`, and follow the documentation pipeline it triggers. Use when asked to trigger the demo, change the minimum payment amount, run the pipeline, or reset the demo state afterwards.
---

# Demo flow

The demo is one sentence: **you change one line of code, and the system works out
which documentation that just made wrong.**

Your job is to make that change, push it, and follow what happens. Then, when
asked, put everything back so it can be run again.

## Before you touch anything

The services must be up, and code2doc takes **90+ seconds** to load 3.6GB of
models. `scripts/run.py` gives up waiting after 90s and prints
`✗ code2doc did not come up` — that message is usually a lie. Check health
rather than trusting it.

```bash
cd /c/Shubham/cognizant_projects/visa_platform/dashboard
python scripts/run.py status
curl -s http://127.0.0.1:8099/health     # want: models_loaded true AND watching set
curl -s http://127.0.0.1:8077/health     # want: status ok, non-empty counts
```

If the spine reports empty counts, the graph is missing — `data/` is gitignored
because it is a live database directory. `python scripts/run.py restore-graph`
unpacks the committed snapshot and needs no credentials.

**`watching` must be a branch name, not `null`.** If it is null, `watch_error`
says why — almost always a missing `GITHUB_TOKEN`, because `.env` and
`demo/.env` are gitignored and a fresh clone has neither. Nothing will happen
when you push until that is fixed, and the run history will stay silent rather
than reporting an error.

If they are down, `python scripts/run.py start`, then poll `/health` until
`models_loaded` is true. Do not proceed before it is — the pipeline will fail.

**Record the baseline before changing anything**, because you will need it to
reset:

```bash
cd ../app_src && git ls-remote --heads origin development
```

## Where the change goes

| | |
|---|---|
| Repo | `C:\Shubham\cognizant_projects\visa_platform\app_src` |
| Branch | **`development`** — the only branch the watcher polls |
| File | `src/main/java/com/poc/paymentprocessing/dto/PaymentRequestDTO.java` |
| Line | 31, the `@DecimalMin` on `amount` |

```java
@DecimalMin(value = "0.01", message = "amount must be greater than zero")
```

**Check it actually says `0.01` first.** If it says anything else, a previous
run was not reset — the branch still carries that commit and the Confluence page
may already show the value you are about to demo changing. Reset before running,
or the demo shows nothing changing.

Change the value and the message together. Pick a number that is not already in
the page history — 1.00, 2.00, 5.00 and 100.00 have all been used.

```java
@DecimalMin(value = "25.00", message = "amount must be at least 25.00")
```

**Why this line and not another.** The Confluence page
`payment-service-technical-design` (id `2097154`), section *3. Entity and Data
Model*, contains the literal table cell:

```
| amount | BigDecimal | Minimum 0.01 | Payment amount |
```

That is what makes the staleness provable rather than asserted. A rename or a
reformat gives retrieval nothing to work with and the pipeline will correctly
decline to change anything — which is a fine thing to demo deliberately, but not
what someone asking for "the demo" wants.

## Making it

```bash
cd /c/Shubham/cognizant_projects/visa_platform/app_src
git checkout development && git pull --ff-only origin development
```

Edit the line, then commit with a message that reads like a developer wrote it —
the commit subject is shown on screen and is what the analysis reasons over:

```
feat: raise minimum payment amount to 25.00

The downstream processor rejects settlements below 25.00 in the transaction
currency, so accepting them here only defers the failure. Enforcing the floor
at the DTO boundary turns a late settlement error into an immediate 400 with
a clear message.
```

Then `git push origin development`.

## Following it

Detection takes ~3 seconds, the whole pipeline ~20-30.

```bash
curl -s http://127.0.0.1:8099/runs | python -c "
import json,sys; d=json.load(sys.stdin)
r = d if isinstance(d,list) else d.get('runs',[])
print(r[0]['run_id'], r[0]['sha'][:8], r[0]['status'])"
```

Poll until `status` is `proposed`. **Run ids are `run-` plus twelve hex
characters, not seven** — take the id from the listing rather than constructing
it from a short sha, or you will poll a 404 forever.

Then read the result:

```bash
curl -s http://127.0.0.1:8099/runs/<run_id> | python -c "
import json,sys
r=json.load(sys.stdin)
print(r['analysis']['summary'])
for p in r['proposals']:
    print(f\"{p['heading_path']:34} needs_change={p['needs_change']} \"
          f\"vec={p['vector_score']:.3f} rerank={p['rerank_score']:+.2f} \"
          f\"published={p['published']}\")"
```

**What to point at.** One section is edited and the others are declined with
specific reasons. The vector scores usually cluster within a few thousandths
while the reranker separates them by six or seven points — on at least one run
the embedding ranked a *wrong* section above the right one and the reranker
inverted it. That contrast is the strongest thing in the demo. The target
section has scored `+2.65` on every run so far, across four different threshold
values, which is worth saying if anyone suspects a cherry-picked example.

The dashboard shows the same thing at **http://localhost:5173/live**.

## Publishing

Do not publish unless asked. It writes to a live Confluence page, and it is
gated behind two explicit human confirmations for a reason. The human clicks it
in the UI.

Two things to know. `published: false` in a run is a **point-in-time reading** —
someone approving in the UI a minute later will flip it, and it has caught this
project out repeatedly, so re-check before asserting anything. And once one
proposal is published, any other proposal touching the same text goes stale and
will fail its check. One publish per page, then reset.

## Resetting

Do all four parts. Skipping any leaves the next run misleading.

```bash
cd /c/Shubham/cognizant_projects/visa_platform/dashboard
python scripts/run.py stop          # sqlite is locked while code2doc runs
```

**1. The branch.** Force-push back to the recorded baseline. This removes the
commit rather than reverting it, so the watcher does not fire again:

```bash
cd ../app_src
git reset --hard <baseline sha>
git push --force-with-lease origin development
```

**2. The run record and the watermark.** Delete the run, and point the watermark
at the baseline sha so the watcher treats current HEAD as already seen:

```bash
cd ../dashboard && python - <<'PY'
import sqlite3
RUN, SHA = "<run_id>", "<baseline full sha>"
db = sqlite3.connect("demo/data/runs.sqlite", timeout=15)
db.execute("DELETE FROM events WHERE run_id = ?", (RUN,))
db.execute("DELETE FROM runs   WHERE run_id = ?", (RUN,))
db.execute("UPDATE watermarks SET sha = ? WHERE branch = 'development'", (SHA,))
db.commit(); db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
print("runs left:", db.execute("SELECT COUNT(*) FROM runs").fetchone()[0])
PY
```

**3. Confluence, if anything was published.** Check first — do not assume:

```bash
python - <<'PY'
import os, re, httpx
from dotenv import load_dotenv
load_dotenv("demo/.env"); load_dotenv(".env")
base = os.getenv("CONFLUENCE_BASE_URL","").rstrip("/")
c = httpx.Client(base_url=base, auth=(os.getenv("CONFLUENCE_EMAIL"), os.getenv("CONFLUENCE_API_TOKEN")), timeout=30)
d = c.get("/wiki/api/v2/pages/2097154", params={"body-format":"storage"}).json()
print("v", d["version"]["number"], d["version"].get("message"))
print(re.findall(r"Minimum[^<]{0,12}", d["body"]["storage"]["value"]))
PY
```

If it does not read `Minimum 0.01`, restore the last clean version by fetching
its body and PUTting it back as a new version. Confluence has no destructive
undo, so this adds a version rather than removing one — that is expected, and
the version message should say why:

```bash
python - <<'PY'
import os, re, httpx
from dotenv import load_dotenv
load_dotenv("demo/.env"); load_dotenv(".env")
base = os.getenv("CONFLUENCE_BASE_URL","").rstrip("/")
auth = (os.getenv("CONFLUENCE_EMAIL"), os.getenv("CONFLUENCE_API_TOKEN"))
c = httpx.Client(base_url=base, auth=auth, timeout=30)
GOOD = 7   # a version whose body reads Minimum 0.01 — check before trusting
body = c.get("/wiki/rest/api/content/2097154",
             params={"status":"historical","version":GOOD,"expand":"body.storage"}
            ).json()["body"]["storage"]["value"]
assert "Minimum 0.01" in body, "that version is not clean — pick another"
cur = c.get("/wiki/api/v2/pages/2097154").json()
r = c.put("/wiki/api/v2/pages/2097154", json={
    "id":"2097154","status":"current","title":cur["title"],
    "body":{"representation":"storage","value":body},
    "version":{"number":cur["version"]["number"]+1,
               "message":f"Revert to v{GOOD} - published during a demo run"}})
print("PUT", r.status_code)
PY
```

**4. Restart and verify.** Confirm the run count is back to its baseline and no
new run fired on restart:

```bash
python scripts/run.py start
curl -s http://127.0.0.1:8099/runs | python -c "
import json,sys; d=json.load(sys.stdin)
r = d if isinstance(d,list) else d.get('runs',[]); print(len(r),'runs')"
```

## Things that will waste your time

- **Use `localhost:5173`, never `127.0.0.1:5173`.** The spine's CORS allow-list
  has only `localhost`, and the graph explorer will claim the spine is down when
  it is running perfectly. `run.py` prints the `127.0.0.1` form, which is the
  trap.
- **`run.py` reporting code2doc as failed usually means slow, not failed.** Read
  `logs/code2doc.log` and look for `Application startup complete`.
- **Do not push the dashboard repo to `development`.** `dashboard` and
  `development` are unrelated histories in the same GitHub repo — one holds the
  tooling, the other the Java app. Force-pushing one onto the other destroys the
  demo.
- **CI and Security take minutes**; the documentation pipeline takes seconds.
  The gap is the point, but do not wait on CI on camera.
