"""Task 27: pipeline/README.md is plain, links resolve, and every number comes from the data files."""

import json
import re
import tomllib
from pathlib import Path

import pytest

from pipeline.check_sources import find_banned_terms

REPO = Path(__file__).resolve().parents[2]
README = REPO / "pipeline" / "README.md"
DATA = REPO / "web" / "public" / "data"

NUMBER = re.compile(r"\d[\d,.]*\d|\d")


def text():
    return README.read_text(encoding="utf-8")


def numbers_in(value):
    """Every number a data value can show: numbers as written, and digit runs inside strings."""
    out = set()
    if isinstance(value, bool) or value is None:
        return out
    if isinstance(value, (int, float)):
        out.add(str(value))
        out.add(f"{value:,}")
    elif isinstance(value, str):
        out |= set(re.findall(r"\d+(?:\.\d+)?", value))
    elif isinstance(value, dict):
        for v in value.values():
            out |= numbers_in(v)
    elif isinstance(value, list):
        for v in value:
            out |= numbers_in(v)
    return out


def allowed_numbers():
    allowed = set()
    for name in ("index.json", "summary.json"):
        allowed |= numbers_in(json.loads((DATA / name).read_text(encoding="utf-8")))
    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    race_files = sorted((DATA / "race").glob("*.json"))
    all_files = [p for p in DATA.rglob("*") if p.is_file()]
    # Counts of what the data files list or hold.
    allowed |= {str(len(index["corners"])), str(len(index["pairs"])), str(len(race_files)), str(len(all_files))}
    allowed.add(str(len(json.loads(race_files[0].read_text(encoding="utf-8"))["races"])))
    # The Python version comes from pyproject.toml.
    requires = tomllib.loads((REPO / "pyproject.toml").read_text(encoding="utf-8"))["project"]["requires-python"]
    allowed |= set(re.findall(r"\d+(?:\.\d+)?", requires))
    return allowed


def test_the_readme_exists_and_is_not_empty():
    assert len(text().split()) > 200


def test_every_number_in_the_readme_comes_from_the_data_files_or_pyproject():
    allowed = allowed_numbers()
    # Fenced code blocks hold commands, not claims.
    prose = re.sub(r"```.*?```", "", text(), flags=re.S)
    found = [n.strip(".,") for n in NUMBER.findall(prose)]
    unsourced = sorted({n for n in found if n and n not in allowed})
    assert unsourced == [], f"numbers not found in index.json, summary.json, a race file or pyproject.toml: {unsourced}"


def test_the_readme_states_the_python_version_from_pyproject():
    requires = tomllib.loads((REPO / "pyproject.toml").read_text(encoding="utf-8"))["project"]["requires-python"]
    assert "3.12" in requires and "Python 3.12" in text()


def test_no_banned_words():
    assert find_banned_terms(text()) == []


def test_the_five_commands_are_documented_and_fetch_osm_is_not():
    body = text()
    for command in ("validate", "build", "check", "verify", "check_sources"):
        assert f"python -m pipeline {command}" in body, command
    assert "fetch_osm" not in body


def test_install_notes():
    assert "pip install -e ." in text()


@pytest.mark.parametrize(
    "phrase",
    [
        "raw/mta_local_bus.zip",
        "SHA-256",
        "Never commit",
        "never downloads",
        "data/osm/ways.json",
        "never fetches",
        "requires_feed",
        "skipped with a visible message",
    ],
)
def test_pinning_osm_and_golden_notes_are_present(phrase):
    assert phrase in " ".join(text().split())


def test_feed_credit_and_no_endorsement():
    body = text()
    assert "https://feeds.mta.maryland.gov/gtfs/local-bus" in body
    assert "not endorsed by MDOT MTA" in " ".join(body.split())
    assert "OpenStreetMap contributors" in body


def test_links_resolve_to_real_files():
    links = re.findall(r"\]\(([^)#]+)\)", text())
    relative = [link for link in links if not link.startswith("http")]
    for link in relative:
        assert (README.parent / link).resolve().is_file(), link
    assert "../docs/planning/race-brief.md" in relative
    assert "../.kiro/specs/race-engine/design.md" in relative
