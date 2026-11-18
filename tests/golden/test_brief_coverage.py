"""
Task 25.4: every numbered test case in race-brief.md tables 5.1 to 5.8 has an
assertion in a named test. Section 5.9 (display rounding) moved to the
race-screen spec.

The brief's tables are read for their case counts, so a row added to the brief
without a matching entry here fails this test. The map names the test that
holds each case; each name must exist in its file. No feed is needed.
"""

import ast
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
BRIEF = REPO / "docs" / "planning" / "race-brief.md"
T = REPO / "tests"

# section -> {case number: (test file, test function)}
COVERAGE = {
    "5.1": {
        **{n: ("golden/test_clock_golden.py", "test_next_departure_cases") for n in (1, 2, 3, 4)},
        **{n: ("golden/test_clock_golden.py", "test_before_table_cases") for n in (5, 6)},
        **{n: ("golden/test_clock_golden.py", "test_ride_cases") for n in (7, 8)},
    },
    "5.2": {
        1: ("golden/test_race_golden.py", "test_case_1_lead_pair_10_00"),
        2: ("golden/test_race_golden.py", "test_case_3_lead_pair_10_30_photo_finish"),
        3: ("golden/test_race_golden.py", "test_case_4_lead_pair_10_31"),
        4: ("golden/test_race_golden.py", "test_case_5_lead_pair_13_52"),
        5: ("unit/test_race.py", "test_case_5_chooses_trip_that_arrives_first_not_first_to_leave"),
        6: ("unit/test_race.py", "test_case_6_no_trips_is_no_one_seat_ride"),
    },
    "5.3": {
        **{n: ("unit/test_stops.py", "test_walk_formula_brief_cases") for n in (1, 2, 3, 4)},
        5: ("golden/test_stops_golden.py", "test_case_5_preston_caroline_to_stop_8564"),
        6: ("golden/test_stops_golden.py", "test_case_6_aliceanna_bond_to_stop_9486"),
        7: ("golden/test_stops_golden.py", "test_case_7_preston_caroline_to_stop_4053"),
    },
    "5.4": {
        1: ("golden/test_eligible_golden.py", "test_case_1_active_services_on_service_date"),
        2: ("golden/test_eligible_golden.py", "test_case_2_preston_caroline_to_aliceanna_bond"),
        3: ("golden/test_eligible_golden.py", "test_case_3_aliceanna_bond_to_preston_caroline"),
        4: ("golden/test_eligible_golden.py", "test_case_4_westwood_carey_to_aliceanna_bond"),
        5: ("golden/test_eligible_golden.py", "test_case_5_no_pair_is_empty_at_400_m"),
        6: ("golden/test_eligible_golden.py", "test_case_6_sensitivity_empty_pairs"),
        7: ("unit/test_eligible.py", "test_trip_reaching_dest_before_origin_is_skipped"),
        8: ("unit/test_eligible.py", "test_exception_type_2_removes_service"),
    },
    "5.5": {
        1: ("golden/test_race_golden.py", "test_case_1_lead_pair_10_00"),
        2: ("golden/test_race_golden.py", "test_case_2_lead_pair_10_21"),
        3: ("golden/test_race_golden.py", "test_case_3_lead_pair_10_30_photo_finish"),
        4: ("golden/test_race_golden.py", "test_case_4_lead_pair_10_31"),
        5: ("golden/test_race_golden.py", "test_case_5_lead_pair_13_52"),
        6: ("golden/test_race_golden.py", "test_case_6_lead_pair_9_00_before_table"),
        7: ("golden/test_race_golden.py", "test_case_7_reverse_pair_13_52"),
        8: ("golden/test_race_golden.py", "test_case_8_westwood_carey_11_23_today_wins"),
    },
    "5.7": {
        1: ("unit/test_summary.py", "test_arrival_weighted_wait_brief_5_7_cases"),
        2: ("unit/test_summary.py", "test_arrival_weighted_wait_brief_5_7_cases"),
        3: ("unit/test_summary.py", "test_arrival_weighted_wait_brief_5_7_cases"),
        4: ("unit/test_summary.py", "test_arrival_weighted_wait_brief_5_7_case_4_exceeds_half_mean_gap"),
        5: ("unit/test_summary.py", "test_arrival_weighted_wait_brief_5_7_case_5_empty_warns_none"),
    },
    "5.8": {
        1: ("golden/test_route_golden.py", "test_case_1_aliceanna_street_eastbound"),
        2: ("golden/test_route_golden.py", "test_case_2_brevard_street_inferred"),
        3: ("golden/test_route_golden.py", "test_case_3_lanvale_street_bridged_gap"),
        4: ("golden/test_route_golden.py", "test_case_4_westbound_all_14_legs"),
        5: ("golden/test_route_golden.py", "test_case_5_loop_plus_eastbound"),
        6: ("golden/test_route_golden.py", "test_case_6_gilmor_end_and_lanvale_start_are_the_same_point"),
    },
}

# 5.6 is a per-pair table, not numbered cases: 20 pair rows plus the totals row.
SUMMARY_TESTS = ["test_pair_row", "test_totals", "test_ride_verdict_counts", "test_lead_pair_gaps"]


def brief_tables():
    """{section: [case numbers]} for the numbered tables of sections 5.1 to 5.8."""
    out, section = {}, None
    for line in BRIEF.read_text(encoding="utf-8-sig").splitlines():
        m = re.match(r"^### (5\.\d)\b", line)
        if m:
            section = m.group(1)
            continue
        m = re.match(r"^\| (\d+) \|", line)
        if m and section:
            out.setdefault(section, []).append(int(m.group(1)))
    return out


def function_names(path):
    return {n.name for n in ast.walk(ast.parse(path.read_text(encoding="utf-8-sig"))) if isinstance(n, ast.FunctionDef)}


def test_the_brief_has_the_expected_numbered_cases():
    tables = brief_tables()
    for section, cases in COVERAGE.items():
        assert tables.get(section) == sorted(cases), f"brief section {section} has cases {tables.get(section)}"


def test_every_case_in_the_brief_is_covered_and_section_5_9_is_not_here():
    tables = brief_tables()
    covered = {s: sorted(c) for s, c in COVERAGE.items()}
    for section, cases in tables.items():
        if section in ("5.6", "5.9"):
            continue
        assert covered.get(section) == cases, f"section {section}: brief {cases}, covered {covered.get(section)}"
    assert "5.9" not in COVERAGE  # display rounding moved to the race-screen spec


@pytest.mark.parametrize(
    "section,case,where",
    [(s, c, w) for s, cases in COVERAGE.items() for c, w in cases.items()],
    ids=lambda v: str(v) if not isinstance(v, tuple) else "t",  # keep test names out of the ids
)
def test_the_named_test_exists(section, case, where):
    file, name = where
    assert (T / file).is_file(), f"{section} case {case}: {file} is missing"
    assert name in function_names(T / file), f"{section} case {case}: {name} not found in {file}"


def test_section_5_6_has_twenty_pair_rows_and_golden_tests_for_them():
    text = BRIEF.read_text(encoding="utf-8-sig")
    block = text[text.index("### 5.6") : text.index("### 5.7")]
    pair_rows = [ln for ln in block.splitlines() if re.match(r"^\| \*{0,2}[A-Z][\w &]+ → [A-Z]", ln)]
    assert len(pair_rows) == 20
    names = function_names(T / "golden" / "test_summary_golden.py")
    for name in SUMMARY_TESTS:
        assert name in names
