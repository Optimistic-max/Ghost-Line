"""Tests for the planted-error fixtures of the Skeptic (R8.1 to R8.5)."""

import difflib
from pathlib import Path

from pipeline.check_sources import find_banned_terms

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "tests" / "fixtures" / "skeptic"
CLEAN = FIXTURES / "clean.md"
PLANTED = FIXTURES / "planted.md"

SENTENCE_BUSES = (
    "36 scheduled one-seat buses from Biddle St & Caroline Ave to Caroline St & Eastern Ave "
    "on the Wed Nov 4, 2026 weekday schedule"
)
SENTENCE_RACE = "1938 wins by 30 minutes at 10:00 AM (Preston & Caroline to Aliceanna & Bond)"
PLANTED_SENTENCE = "Ridership on the No. 21 doubled in 1938."


def lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def test_clean_holds_both_required_sentences():
    text = CLEAN.read_text(encoding="utf-8")
    assert SENTENCE_BUSES in text
    assert SENTENCE_RACE in text


def test_planted_differs_from_clean_in_exactly_two_places():
    clean, planted = lines(CLEAN), lines(PLANTED)
    changes = [d for d in difflib.ndiff(clean, planted) if d[:2] in ("- ", "+ ") and d[2:].strip()]  # blank separator lines are not content
    removed = [d[2:] for d in changes if d[0] == "-"]
    added = [d[2:] for d in changes if d[0] == "+"]
    # place 1: one line changes, 36 becomes 38; place 2: one new sentence
    assert len(removed) == 1 and len(added) == 2
    assert "36 scheduled" in removed[0]
    assert added[0] == removed[0].replace("36 scheduled", "38 scheduled")
    assert added[1] == PLANTED_SENTENCE


def test_the_only_changed_token_in_the_edited_line_is_the_count():
    clean, planted = lines(CLEAN), lines(PLANTED)
    pairs = [(c, p) for c, p in zip(clean, planted) if c != p]
    assert len(pairs) == 1
    old_words, new_words = pairs[0][0].split(), pairs[0][1].split()
    assert len(old_words) == len(new_words)
    assert [(o, n) for o, n in zip(old_words, new_words) if o != n] == [("36", "38")]


def test_planted_sentence_appears_only_in_planted():
    assert PLANTED_SENTENCE in PLANTED.read_text(encoding="utf-8")
    assert PLANTED_SENTENCE not in CLEAN.read_text(encoding="utf-8")


def test_neither_file_has_a_banned_term():
    assert find_banned_terms(CLEAN.read_text(encoding="utf-8")) == []
    assert find_banned_terms(PLANTED.read_text(encoding="utf-8")) == []


def test_the_files_are_outside_docs_and_nothing_with_these_names_is_in_docs():
    docs = (REPO / "docs").resolve()
    for path in (CLEAN, PLANTED):
        assert docs not in path.resolve().parents
    assert not list(docs.rglob("planted.md")) and not list((docs).rglob("clean.md"))
    assert FIXTURES.resolve().relative_to(REPO.resolve()).as_posix() == "tests/fixtures/skeptic"
