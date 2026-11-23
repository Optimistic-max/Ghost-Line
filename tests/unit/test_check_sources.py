"""Unit tests for pipeline/check_sources.py. All files are made up in tmp_path."""

import json
from pathlib import Path

import pytest

from pipeline.check_sources import (
    ALLOWED_PHRASE,
    check_json_sources,
    check_prose,
    default_json_paths,
    default_prose_paths,
    find_banned_terms,
    is_excluded,
)
from tests.unit.test_emit import run_emit


def write(root: Path, rel: str, text: str) -> Path:
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return p


# --- find_banned_terms (19.1) ------------------------------------------------


@pytest.mark.parametrize("term", ["live", "real-time", "realtime", "arriving now", "right now"])
def test_each_banned_term_is_found(term):
    assert find_banned_terms(f"The bus is {term} today.") == [term]


@pytest.mark.parametrize("text", ["citywide", "Citywide", "CITYWIDE"])
def test_citywide_is_banned(text):
    # product.md rule 6: the counts cover this line's 20 corner pairs only (polish brief P3).
    assert find_banned_terms(f"Trolley first {text}.") == [text]


@pytest.mark.parametrize("text", ["LIVE", "Live", "Real-Time", "REALTIME", "Arriving Now", "Right NOW"])
def test_matching_is_case_insensitive(text):
    assert find_banned_terms(f"x {text} y") == [text]


@pytest.mark.parametrize("text", ["deliver", "olive", "lives", "delivered", "alive", "liver", "realtor", "outlive"])
def test_deliver_olive_lives_and_similar_are_not_flagged(text):
    assert find_banned_terms(f"We {text} here.") == []


def test_exact_allowed_phrase_is_not_flagged():
    assert find_banned_terms(f"{ALLOWED_PHRASE} Weekday schedule as of Nov 4, 2026.") == []
    assert ALLOWED_PHRASE == "Scheduled, not live."


def test_a_banned_term_beside_the_allowed_phrase_is_still_flagged():
    assert find_banned_terms(f"{ALLOWED_PHRASE} Bus arriving now.") == ["arriving now"]


def test_allowed_phrase_must_be_exact():
    assert find_banned_terms("scheduled, not live.") == ["live"]
    assert find_banned_terms("Scheduled, not live") == ["live"]


def test_several_terms_in_one_text_are_all_reported_in_order():
    assert find_banned_terms("right now, live, realtime") == ["right now", "live", "realtime"]


def test_clean_text_has_no_findings():
    assert find_banned_terms("Scheduled departure 10:32. Weekday schedule.") == []


@pytest.mark.parametrize(
    "text",
    [
        '<div aria-live="polite">Scheduled 10:32</div>',
        "<div aria-live='assertive'>x</div>",
        "<div aria-live=polite>x</div>",
        '<div ARIA-LIVE = "polite">x</div>',
        'el.setAttribute("aria-live", "polite")',
        "[aria-live] { color: red }",
    ],
)
def test_aria_live_attribute_is_allowed(text):
    assert find_banned_terms(text) == []


def test_live_in_prose_still_fails_next_to_aria_live():
    assert find_banned_terms('<p aria-live="polite">The bus is live.</p>') == ["live"]
    assert find_banned_terms("aria-live and live") == ["live"]


def test_aria_live_exception_is_not_a_general_hyphen_exception():
    assert find_banned_terms("a live-action trolley") == ["live"]
    assert find_banned_terms("not-aria-live is odd but real-time is not ok") == ["real-time"]


def test_aria_live_in_a_file_passes_and_prose_live_fails(tmp_path):
    ok = write(tmp_path, "web/index.html", '<div aria-live="polite"></div>\n')
    bad = write(tmp_path, "docs/notes.md", "Service is live.\n")
    assert check_prose([ok], root=tmp_path) == []
    assert check_prose([bad], root=tmp_path) == ["docs/notes.md:1: banned term 'live'"]


# --- check_prose (19.2) ------------------------------------------------------


def test_check_prose_reports_file_line_and_term(tmp_path):
    f = write(tmp_path, "docs/notes.md", "fine line\nthe bus is live now\nok\n")
    assert check_prose([f], root=tmp_path) == ["docs/notes.md:2: banned term 'live'"]


def test_check_prose_clean_file_returns_nothing(tmp_path):
    f = write(tmp_path, "README.md", f"{ALLOWED_PHRASE}\nOlive Street delivers.\n")
    assert check_prose([f], root=tmp_path) == []


def test_check_prose_applies_exclusions(tmp_path):
    bad = "right now\n"
    paths = [
        write(tmp_path, "docs/planning/brief.md", bad),
        write(tmp_path, "web/node_modules/pkg/readme.md", bad),
        write(tmp_path, "web/dist/index.html", bad),
        write(tmp_path, "web/public/data/index.json", bad),
    ]
    assert check_prose(paths, root=tmp_path) == []


def test_check_prose_skips_missing_files(tmp_path):
    assert check_prose([tmp_path / "nope.md"], root=tmp_path) == []


def test_is_excluded(tmp_path):
    assert is_excluded(tmp_path / "docs" / "planning" / "x.md", tmp_path)
    assert is_excluded(tmp_path / "web" / "public" / "data" / "race" / "x.json", tmp_path)
    assert not is_excluded(tmp_path / "docs" / "video_script.md", tmp_path)
    assert not is_excluded(tmp_path / "web" / "src" / "main.ts", tmp_path)


def test_default_prose_paths_follow_the_scan_rule(tmp_path):
    keep = [
        write(tmp_path, "web/index.html", "x"),
        write(tmp_path, "web/src/main.ts", "x"),
        write(tmp_path, "web/src/deep/part.css", "x"),
        write(tmp_path, "docs/devpost.md", "x"),
        write(tmp_path, "README.md", "x"),
    ]
    write(tmp_path, "docs/planning/brief.md", "x")
    write(tmp_path, "docs/notes.txt", "x")  # only docs/*.md is scanned
    write(tmp_path, "web/dist/a.js", "x")
    write(tmp_path, "web/node_modules/p/a.js", "x")
    write(tmp_path, "web/public/data/index.json", "x")
    write(tmp_path, "web/vite.config.ts", "x")  # not in the scan list
    assert default_prose_paths(tmp_path) == sorted(keep)


def test_default_prose_paths_with_nothing_present(tmp_path):
    assert default_prose_paths(tmp_path) == []


# --- check_json_sources (19.3) -----------------------------------------------


@pytest.fixture
def emitted(tmp_path):
    run_emit(tmp_path)
    return tmp_path


def all_json(root: Path) -> list[Path]:
    return [root / "index.json", root / "summary.json", root / "route.geojson", *sorted((root / "race").glob("*.json"))]


def test_good_generated_files_are_clean(emitted):
    assert check_json_sources(all_json(emitted)) == []


def test_no_files_is_clean():
    assert check_json_sources([]) == []


def test_unresolved_id_is_reported(emitted):
    p = emitted / "summary.json"
    doc = json.loads(p.read_text(encoding="utf-8"))
    doc["sources"]["races"] = ["mta_gtfs", "made_up_id"]
    p.write_text(json.dumps(doc), encoding="utf-8")
    violations = check_json_sources(all_json(emitted))
    assert any("made_up_id" in v for v in violations)


def test_uncovered_numeric_field_is_reported(emitted):
    p = emitted / "route.geojson"
    doc = json.loads(p.read_text(encoding="utf-8"))
    doc["total_length"] = 8401
    p.write_text(json.dumps(doc), encoding="utf-8")
    violations = check_json_sources(all_json(emitted))
    assert any("total_length" in v for v in violations)


def test_index_is_found_next_to_a_listed_race_file(emitted):
    race = sorted((emitted / "race").glob("*.json"))[0]
    assert check_json_sources([race]) == []


def test_missing_index_is_a_violation(tmp_path):
    p = write(tmp_path, "summary.json", "{}")
    assert any("index.json not found" in v for v in check_json_sources([p]))


def test_unreadable_json_is_a_violation(emitted):
    (emitted / "summary.json").write_text("{not json", encoding="utf-8")
    assert any("cannot read as JSON" in v for v in check_json_sources(all_json(emitted)))


def test_default_json_paths_lists_existing_generated_files(emitted):
    root = emitted / "repo"
    data = root / "web" / "public" / "data"
    data.mkdir(parents=True)
    for p in all_json(emitted):
        target = data / p.relative_to(emitted)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(p.read_bytes())
    assert default_json_paths(root) == all_json(data)
    assert default_json_paths(emitted / "empty") == []


# --- prose and JSON are separate operations ----------------------------------


def test_prose_check_ignores_json_source_problems(emitted):
    p = emitted / "summary.json"
    doc = json.loads(p.read_text(encoding="utf-8"))
    doc["sources"]["races"] = ["made_up_id"]
    p.write_text(json.dumps(doc), encoding="utf-8")
    assert check_prose([p], root=emitted) == []  # JSON files are not prose


def test_json_check_ignores_banned_words(emitted):
    p = emitted / "index.json"
    doc = json.loads(p.read_text(encoding="utf-8"))
    doc["line"] = "live right now"
    p.write_text(json.dumps(doc), encoding="utf-8")
    assert check_json_sources(all_json(emitted)) == []
