"""Turn a code change into documentation queries, and a retrieved section into a
proposed edit.

Two Claude calls, deliberately separate.

*Why the diff is not the query.* Measured on this corpus with
bge-reranker-v2-m3, scoring the same target section against the same
distractor:

    statement about the change   -2.779   (margin 8.25)
    raw diff                     -0.747   (margin 6.59)
    question the doc answers     +0.544   (margin 11.54)
    question + entity            +1.548   (margin 12.24)
    topic / noun phrase          +2.965   (margin 13.69)

A 5.7 logit swing from phrasing alone, on identical content. The cross-encoder
scores "does this passage answer this query", and a narrative of what changed is
not something a specification answers -- it answers what the system *is*. So the
first call converts the diff into topic-shaped queries describing the subject
matter, not the edit. That is also what pulls the correct section back above
zero, which is what makes a confidence threshold mean anything.

*Why two calls.* Retrieval queries are cheap, short and want breadth; a redline
wants the actual section in front of it. Merging them would force the model to
propose edits to sections it had not yet seen.
"""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, Field

MODEL = "claude-opus-5"


class DocQuery(BaseModel):
    """One retrieval probe derived from a change."""

    topic: str = Field(description="Noun phrase naming the subject matter, e.g. 'payment amount validation constraint minimum value'. Not a description of the change.")
    question: str = Field(description="A question the documentation would answer about this subject, e.g. 'What is the minimum accepted payment amount?'")
    rationale: str = Field(description="One sentence: why this change could make documentation on this topic stale.")


class ChangeAnalysis(BaseModel):
    summary: str = Field(description="One sentence describing what the change does, in business terms.")
    change_kind: str = Field(description="One of: behaviour, api-contract, validation, configuration, refactor, test-only, cosmetic.")
    doc_impact_expected: bool = Field(description="False for refactors, formatting and test-only edits that cannot make prose stale.")
    queries: list[DocQuery] = Field(description="One to four retrieval probes, most specific first.")


class Redline(BaseModel):
    needs_change: bool = Field(description="False if the retrieved section is already correct or is not actually about this change.")
    existing_text: str = Field(description="The exact text to be replaced, copied verbatim from the section. Empty when needs_change is false.")
    proposed_text: str = Field(description="The replacement text, in the same format and style as the original. Empty when needs_change is false.")
    rationale: str = Field(description="One or two sentences a reviewer can check, naming what in the diff makes the current text wrong.")
    code_citation: str = Field(description="File and symbol from the diff that justifies the edit.")
    confidence: str = Field(description="high, medium or low.")


SYSTEM_ANALYST = """You convert code changes into documentation retrieval queries.

The retrieval engine is a cross-encoder that scores "does this passage answer \
this query". Documentation states what a system IS. It does not narrate changes. \
So a query phrased as "X changed from A to B" scores badly against the very \
section that documents X, while a query naming the subject matter scores well.

Write queries about the SUBJECT MATTER the change touches, never about the change \
itself. Never include diff syntax, +/- markers, or commit phrasing.

Good:  "payment amount validation constraint minimum value"
Bad:   "the minimum payment amount was changed from 0.01 to 1.00"

If the change cannot make prose documentation stale -- a pure refactor, a \
formatting pass, a test-only edit -- say so with doc_impact_expected false and \
return no queries."""


SYSTEM_REDLINE = """You propose a minimal edit to one documentation section, given a code change.

Rules:
- Change only what the code change makes untrue. Leave everything else byte-identical.
- Preserve the existing format exactly. A markdown table row stays a table row \
with the same columns.
- existing_text must be copied verbatim from the section provided. If you cannot \
quote it exactly, set needs_change false.
- If the section is already correct, or is not actually about this change, set \
needs_change false. A wrong edit is far more costly than a missed one -- a \
reviewer can find what you missed, but may approve what you got subtly wrong.
- Never invent behaviour the diff does not show."""


def _client() -> Any:
    import anthropic

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to demo/.env."
        )
    return anthropic.Anthropic()


def analyse_change(diff: str, context: str = "") -> ChangeAnalysis:
    """Diff in, retrieval queries out."""
    response = _client().messages.parse(
        model=MODEL,
        max_tokens=4000,
        thinking={"type": "adaptive"},
        system=SYSTEM_ANALYST,
        messages=[
            {
                "role": "user",
                "content": f"{context}\n\nCode change:\n\n```diff\n{diff}\n```".strip(),
            }
        ],
        output_format=ChangeAnalysis,
    )
    return response.parsed_output


def propose_redline(diff: str, section_title: str, section_text: str, summary: str = "") -> Redline:
    """One retrieved section in, one proposed edit out."""
    response = _client().messages.parse(
        model=MODEL,
        max_tokens=4000,
        thinking={"type": "adaptive"},
        system=SYSTEM_REDLINE,
        messages=[
            {
                "role": "user",
                "content": (
                    f"Code change{f' ({summary})' if summary else ''}:\n\n"
                    f"```diff\n{diff}\n```\n\n"
                    f"Documentation section: {section_title}\n\n"
                    f"```\n{section_text}\n```"
                ),
            }
        ],
        output_format=Redline,
    )
    return response.parsed_output
