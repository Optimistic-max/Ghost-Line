"""
Source checks (B5, B16). Two separate operations:

- check_prose: banned words in prose that readers see (honesty rule 1).
- check_json_sources: the generated JSON source mappings (every source ID
  resolves, every numeric block is covered).

Both return a list of violation strings, empty when clean. They never raise
for a violation and never touch the network.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from pipeline.emit import check_source_coverage
from pipeline.errors import ValidationError

BANNED_TERMS = ["live", "real-time", "realtime", "arriving now", "right now"]
ALLOWED_PHRASE = "Scheduled, not live."
PROSE_PATHS = ["web/index.html", "web/src/**", "docs/*.md", "README.md"]
PROSE_EXCLUDES = ["docs/planning", "node_modules", "dist", "web/public/data"]

# Whole words or phrases, case-insensitive. \b keeps deliver, olive and lives out.
_BANNED_RE = re.compile(r"\b(" + "|".join(re.escape(t) for t in BANNED_TERMS) + r")\b", re.IGNORECASE)

JSON_PATHS = ["web/public/data/index.json", "web/public/data/summary.json", "web/public/data/route.geojson"]
RACE_DIR = "web/public/data/race"


def find_banned_terms(text: str) -> list[str]:
    """Banned terms found in text, in order, as written. The exact phrase
    "Scheduled, not live." is allowed and does not count."""
    return [m.group(0) for m in _BANNED_RE.finditer(text.replace(ALLOWED_PHRASE, ""))]


def _relative(path: Path, root: Path) -> str:
    try:
        return path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def is_excluded(path: Path, root: Path) -> bool:
    """True if path sits under docs/planning, web/public/data, or any node_modules or dist folder."""
    rel = _relative(path, root)
    parts = rel.split("/")
    if "node_modules" in parts or "dist" in parts:
        return True
    return any(rel == ex or rel.startswith(ex + "/") for ex in ("docs/planning", "web/public/data"))


def default_prose_paths(root: Path) -> list[Path]:
    """Files named by the prose scan rule, exclusions applied. Missing ones are skipped."""
    root = Path(root)
    found: list[Path] = []
    for pattern in PROSE_PATHS:
        if pattern.endswith("/**"):
            base = root / pattern[: -len("/**")]
            matches = [p for p in base.rglob("*") if p.is_file()] if base.is_dir() else []
        else:
            matches = [p for p in root.glob(pattern) if p.is_file()]
        found.extend(matches)
    return sorted({p for p in found if not is_excluded(p, root)})


def check_prose(paths: list[Path], root: Path | None = None) -> list[str]:
    """Scan prose files for banned terms. Returns "file:line: ..." strings.

    root is the repository root, used to apply the exclusions and to print
    relative paths. It defaults to the current directory.
    """
    root = Path(root) if root is not None else Path.cwd()
    violations: list[str] = []
    for path in paths:
        path = Path(path)
        if is_excluded(path, root) or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for number, line in enumerate(text.splitlines(), start=1):
            for term in find_banned_terms(line):
                violations.append(f"{_relative(path, root)}:{number}: banned term '{term}'")
    return violations


def default_json_paths(root: Path) -> list[Path]:
    """Generated files that exist under web/public/data."""
    root = Path(root)
    paths = [root / p for p in JSON_PATHS if (root / p).is_file()]
    race_dir = root / RACE_DIR
    if race_dir.is_dir():
        paths.extend(sorted(race_dir.glob("*.json")))
    return paths


def _label(path: Path) -> str:
    if path.name == "index.json":
        return "index"
    if path.name == "summary.json":
        return "summary"
    if path.suffix == ".geojson":
        return "route"
    return f"race/{path.name}"


def check_json_sources(paths: list[Path]) -> list[str]:
    """Validate generated JSON source mappings (B16).

    Every source ID must resolve in index.sources and every top-level block that
    holds a number must be covered. index.json is taken from paths, or from the
    same folder (or the folder above race/) when it is not listed. Returns
    violation strings; an empty list of paths is clean.
    """
    paths = [Path(p) for p in paths]
    if not paths:
        return []
    violations: list[str] = []
    docs: dict[str, dict] = {}
    for path in paths:
        try:
            docs[_label(path)] = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            violations.append(f"{path.as_posix()}: cannot read as JSON: {exc}")
    if "index" not in docs:
        first = paths[0]
        for candidate in (first.parent / "index.json", first.parent.parent / "index.json"):
            if candidate.is_file():
                try:
                    docs["index"] = json.loads(candidate.read_text(encoding="utf-8"))
                except json.JSONDecodeError as exc:
                    violations.append(f"{candidate.as_posix()}: cannot read as JSON: {exc}")
                break
        else:
            violations.append("index.json not found: cannot resolve source IDs")
    if "index" in docs:
        try:
            check_source_coverage(docs)
        except ValidationError as exc:
            lines = [ln.strip() for ln in str(exc).splitlines()[1:] if ln.strip()]
            violations.extend(lines or [str(exc)])
    return violations
