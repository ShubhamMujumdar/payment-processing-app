"""code2doc -- find the documentation a code change makes stale.

Pipeline:

    source  ->  chunking  ->  embedding  ->  store
                                              |
                            query  ->  retrieve  ->  reranking  ->  API

Each stage is a module with one job, so a bad result can be attributed to a
stage rather than to "the AI".
"""

__version__ = "0.1.0"
