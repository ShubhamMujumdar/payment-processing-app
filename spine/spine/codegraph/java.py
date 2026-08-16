"""Java source into CodeUnit vertices.

Parsed with tree-sitter rather than regex: a Java file is not a regular language
and heuristic extraction produces a graph nobody can trust. Every unit carries
its file, line range and signature, so a finding can be pointed at.

Provenance is the part that makes rollback possible. Each unit is attributed to
the commit that introduced it, via git blame over its line range, taking the
OLDEST commit touching those lines -- the newest would attribute a class to
whoever last reformatted it. Commits are then mapped to the pull request that
merged them, so the graph can answer "what shipped in PR #14, and what would
back out with it".
"""

from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

import tree_sitter_java
from tree_sitter import Language, Node, Parser

JAVA = Language(tree_sitter_java.language())

_DECLARATIONS = {
    "class_declaration": "class",
    "interface_declaration": "interface",
    "enum_declaration": "enum",
    "record_declaration": "record",
}


@dataclass(slots=True)
class CodeUnit:
    unit_id: str
    kind: str  # class | interface | enum | record | method | field
    name: str
    path: str
    start_line: int
    end_line: int
    signature: str = ""
    parent_id: str | None = None
    calls: list[str] = field(default_factory=list)
    imports: list[str] = field(default_factory=list)
    #: Type names mentioned in a signature (return, parameters, field type).
    #: These become DEPENDS_ON edges wherever they resolve to a type we parsed.
    type_refs: list[str] = field(default_factory=list)
    introduced_in_sha: str | None = None
    introduced_in_pr: int | None = None
    #: Rollback needs what a pull request CHANGED, not only what it created.
    #: A class introduced two years ago and modified by PR #14 still backs out
    #: with #14, so both ends of the range are recorded.
    last_changed_sha: str | None = None
    last_changed_pr: int | None = None
    touched_by_prs: list[int] = field(default_factory=list)

    def to_props(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "name": self.name,
            "path": self.path,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "signature": self.signature,
            "introduced_in_sha": self.introduced_in_sha or "",
            "introduced_in_pr": self.introduced_in_pr or 0,
            "last_changed_sha": self.last_changed_sha or "",
            "last_changed_pr": self.last_changed_pr or 0,
            "touched_by_prs": ",".join(str(p) for p in self.touched_by_prs),
        }


_TYPE_NAME = re.compile(r"\b([A-Z][A-Za-z0-9_]*)\b")

#: Types from the JDK and common frameworks are noise in a codebase graph:
#: everything references String and List, so those edges carry no information.
_TYPE_NOISE = frozenset(
    {
        "String", "Integer", "Long", "Double", "Float", "Boolean", "Byte", "Short",
        "Object", "List", "Map", "Set", "Optional", "Collection", "Arrays", "Objects",
        "BigDecimal", "BigInteger", "LocalDate", "LocalDateTime", "Instant", "UUID",
        "Exception", "RuntimeException", "Override", "Autowired", "Service", "Component",
        "Repository", "Controller", "RestController", "Entity", "Table", "Column", "Id",
        "GeneratedValue", "Enumerated", "Data", "Builder", "NoArgsConstructor",
        "AllArgsConstructor", "RequiredArgsConstructor", "Getter", "Setter", "Slf4j",
        "ResponseEntity", "HttpStatus", "Valid", "NotNull", "NotBlank", "Positive",
    }
)


def _type_names(text: str) -> set[str]:
    return {m.group(1) for m in _TYPE_NAME.finditer(text)} - _TYPE_NOISE


def _text(node: Node, src: bytes) -> str:
    return src[node.start_byte : node.end_byte].decode("utf-8", "replace")


def _child_text(node: Node, field_name: str, src: bytes) -> str:
    child = node.child_by_field_name(field_name)
    return _text(child, src) if child else ""


class JavaGraphBuilder:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root
        self._parser = Parser(JAVA)
        #: file unit id -> import statements, resolved against internal types
        #: once every file has been parsed.
        self._file_imports: dict[str, list[str]] = {}
        self._file_package: dict[str, str] = {}

    # --- parsing -----------------------------------------------------------
    def parse_file(self, path: Path) -> list[CodeUnit]:
        src = path.read_bytes()
        tree = self._parser.parse(src)
        rel = path.relative_to(self.repo_root).as_posix()

        package = ""
        imports: list[str] = []
        for child in tree.root_node.children:
            if child.type == "package_declaration":
                package = _text(child, src).replace("package", "").replace(";", "").strip()
            elif child.type == "import_declaration":
                imports.append(_text(child, src).replace("import", "").replace(";", "").strip())

        units: list[CodeUnit] = []
        file_id = f"file:{rel}"
        self._walk(tree.root_node, src, rel, package, file_id, units, imports)

        # Imports belong to the file, and are resolved to internal types later.
        for unit in units:
            if unit.parent_id == file_id:
                unit.imports = list(imports)
        self._file_imports[file_id] = list(imports)
        self._file_package[file_id] = package
        return units

    def _walk(
        self,
        node: Node,
        src: bytes,
        rel: str,
        package: str,
        parent_id: str | None,
        out: list[CodeUnit],
        imports: list[str],
    ) -> None:
        for child in node.children:
            kind = _DECLARATIONS.get(child.type)

            if kind:
                name = _child_text(child, "name", src)
                unit_id = f"{package}.{name}" if package else name
                out.append(
                    CodeUnit(
                        unit_id=unit_id,
                        kind=kind,
                        name=name,
                        path=rel,
                        start_line=child.start_point[0] + 1,
                        end_line=child.end_point[0] + 1,
                        signature=f"{kind} {name}",
                        parent_id=parent_id,
                    )
                )
                self._walk(child, src, rel, package, unit_id, out, imports)
                continue

            if child.type == "method_declaration" and parent_id:
                name = _child_text(child, "name", src)
                params = _child_text(child, "parameters", src)
                returns = _child_text(child, "type", src)
                unit_id = f"{parent_id}#{name}{params}"
                out.append(
                    CodeUnit(
                        unit_id=unit_id,
                        kind="method",
                        name=name,
                        path=rel,
                        start_line=child.start_point[0] + 1,
                        end_line=child.end_point[0] + 1,
                        signature=f"{returns} {name}{params}".strip(),
                        parent_id=parent_id,
                        calls=sorted(set(self._invocations(child, src))),
                        type_refs=sorted(_type_names(f"{returns} {params}")),
                    )
                )
                continue

            if child.type == "field_declaration" and parent_id:
                declarator = child.child_by_field_name("declarator")
                name = _child_text(declarator, "name", src) if declarator else ""
                if name:
                    out.append(
                        CodeUnit(
                            unit_id=f"{parent_id}.{name}",
                            kind="field",
                            name=name,
                            path=rel,
                            start_line=child.start_point[0] + 1,
                            end_line=child.end_point[0] + 1,
                            signature=_text(child, src).strip().rstrip(";"),
                            parent_id=parent_id,
                            type_refs=sorted(_type_names(_text(child, src))),
                        )
                    )
                continue

            self._walk(child, src, rel, package, parent_id, out, imports)

    def _invocations(self, node: Node, src: bytes) -> Iterator[str]:
        """Called method names inside a body. Name-level only: full resolution
        needs a type checker, so CALLS edges are labelled low-confidence and the
        UI says so."""
        if node.type == "method_invocation":
            name = node.child_by_field_name("name")
            if name:
                yield _text(name, src)
        for child in node.children:
            yield from self._invocations(child, src)

    # --- provenance --------------------------------------------------------
    def _git(self, *args: str) -> str:
        """Git output as text.

        Encoding is forced to UTF-8 with replacement: subprocess defaults to the
        console codepage on Windows (cp1252), which raises on any file
        containing bytes outside it -- and blame output embeds file content.
        """
        result = subprocess.run(
            ["git", *args],
            cwd=self.repo_root,
            capture_output=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        return result.stdout or ""

    def blame_line_shas(self, rel_path: str) -> dict[int, str]:
        """line number -> commit sha, from git blame."""
        out = self._git("blame", "--line-porcelain", "--", rel_path)
        mapping: dict[int, str] = {}
        current: str | None = None
        for line in out.splitlines():
            parts = line.split()
            if len(parts) >= 3 and len(parts[0]) == 40 and parts[0].isalnum():
                current = parts[0]
                try:
                    mapping[int(parts[2])] = current
                except ValueError:
                    pass
        return mapping

    def commit_times(self) -> dict[str, int]:
        out = self._git("log", "--all", "--format=%H %ct")
        times: dict[str, int] = {}
        for line in out.splitlines():
            parts = line.split()
            if len(parts) == 2:
                times[parts[0]] = int(parts[1])
        return times

    def sha_to_pr(self) -> dict[str, int]:
        """Map commits to the pull request that brought them in.

        Read from merge-commit subjects, which GitHub writes as
        'Merge pull request #N from ...'. Commits reachable only from that merge
        are attributed to N.
        """
        mapping: dict[str, int] = {}
        merges = self._git("log", "--all", "--merges", "--format=%H|%P|%s")
        for line in merges.splitlines():
            try:
                sha, parents, subject = line.split("|", 2)
            except ValueError:
                continue
            if "pull request #" not in subject:
                continue
            number = int(subject.split("pull request #")[1].split()[0].rstrip(":"))
            parent_list = parents.split()
            if len(parent_list) < 2:
                continue
            base, head = parent_list[0], parent_list[1]
            contained = self._git("rev-list", f"{base}..{head}")
            for contained_sha in contained.split():
                mapping[contained_sha] = number
            mapping[sha] = number
        return mapping

    def attribute(self, units: list[CodeUnit]) -> None:
        times = self.commit_times()
        pr_of = self.sha_to_pr()
        blame_cache: dict[str, dict[int, str]] = {}

        for unit in units:
            blame = blame_cache.get(unit.path)
            if blame is None:
                blame = self.blame_line_shas(unit.path)
                blame_cache[unit.path] = blame

            shas = {blame[n] for n in range(unit.start_line, unit.end_line + 1) if n in blame}
            if not shas:
                continue
            # Oldest commit touching the range introduced it; the newest would
            # credit whoever last reformatted the file.
            oldest = min(shas, key=lambda s: times.get(s, 0))
            newest = max(shas, key=lambda s: times.get(s, 0))
            unit.introduced_in_sha = oldest
            unit.introduced_in_pr = pr_of.get(oldest)
            unit.last_changed_sha = newest
            unit.last_changed_pr = pr_of.get(newest)
            # Every pull request whose commits are still live in this range.
            # This is the set that matters for "what backs out with PR #N".
            unit.touched_by_prs = sorted(
                {pr for pr in (pr_of.get(sha) for sha in shas) if pr is not None}
            )

    def tracked_files(self) -> list[str]:
        return [line for line in self._git("ls-files").splitlines() if line.strip()]

    def _file_units(self) -> list[CodeUnit]:
        """A unit per tracked file.

        The graph would otherwise cover only Java and miss the pipeline
        definitions, the POM and the docs -- which is exactly where the pull
        requests that exist so far made their changes. A knowledge graph that
        cannot see the workflow files cannot explain a pipeline defect.
        """
        units: list[CodeUnit] = []
        for rel in self.tracked_files():
            path = self.repo_root / rel
            if not path.exists():
                continue
            try:
                line_count = sum(1 for _ in path.open("rb"))
            except OSError:
                continue
            units.append(
                CodeUnit(
                    unit_id=f"file:{rel}",
                    kind="file",
                    name=rel.rsplit("/", 1)[-1],
                    path=rel,
                    start_line=1,
                    end_line=max(1, line_count),
                    signature=rel,
                )
            )
        return units

    # --- entry point -------------------------------------------------------
    def build(self, subdirs: tuple[str, ...] = ("src/main/java", "src/test/java")) -> list[CodeUnit]:
        units: list[CodeUnit] = self._file_units()
        for subdir in subdirs:
            root = self.repo_root / subdir
            if not root.exists():
                continue
            for path in sorted(root.rglob("*.java")):
                units.extend(self.parse_file(path))
        self.attribute(units)
        return units
