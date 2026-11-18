"""
Unit tests for pipeline/route.py using made-up ways (fake data, never written to web/).

Fake geometry runs along latitude 39.3. One thousandth of a degree of longitude
is about 86 m there.
"""

import json
from pathlib import Path

import pytest

from pipeline.errors import RouteError
from pipeline.facts import LegSpec, load_facts
from pipeline.route import (
    build_leg,
    build_route,
    clip_line,
    line_length_m,
    load_ways,
    orient_way,
    validate_leg_length,
    validate_route_joins,
    validate_timing_points,
)

FIXTURE_FACTS = Path(__file__).resolve().parents[1] / "fixtures" / "fake-line.yaml"
LAT = 39.3


def pt(i: int) -> tuple[float, float]:
    """Fake point number i, 0.001 degrees of longitude apart."""
    return (-76.620 + 0.001 * i, LAT)


FAKE_WAYS = {
    "1": [pt(0), pt(1), pt(2)],
    "2": [pt(2), pt(3), pt(4)],
    "3": [pt(4), pt(5), pt(6)],
    # 4 starts 0.0003 degrees (about 26 m) after the end of way 3
    "4": [(pt(6)[0] + 0.0003, LAT), pt(7), pt(8)],
}


def osm_leg(ways, a, b, length, **kw):
    return LegSpec(
        street="Fake Street",
        method=kw.pop("method", "osm"),
        length_m=length,
        osm_ways=ways,
        clip_from_lonlat=pt(a),
        clip_to_lonlat=pt(b),
        **kw,
    )


def true_length(a, b):
    return line_length_m([pt(i) for i in range(a, b + 1)])


def test_inferred_leg_uses_points_and_note():
    pts = [pt(0), pt(1), pt(2)]
    leg = LegSpec(street="Fake Street", method="inferred", length_m=true_length(0, 2), points_lonlat=pts, note="made up")
    built = build_leg(leg, {}, "westbound")
    assert built.coordinates == pts
    assert built.note == "made up"
    assert built.direction == "westbound"
    assert built.method == "inferred"
    assert built.length_m == pytest.approx(true_length(0, 2))


def test_osm_leg_joins_ways_in_listed_order_and_clips():
    leg = osm_leg([1, 2], 1, 3, true_length(1, 3))
    built = build_leg(leg, FAKE_WAYS)
    assert built.coordinates == [pt(1), pt(2), pt(3)]
    assert built.note  # a note is always present


def test_way_stored_backwards_is_flipped_to_continue_the_line():
    ways = {"1": FAKE_WAYS["1"], "2": list(reversed(FAKE_WAYS["2"]))}
    built = build_leg(osm_leg([1, 2], 0, 4, true_length(0, 4)), ways)
    assert built.coordinates == [pt(i) for i in range(5)]


def test_first_way_stored_backwards_is_flipped_toward_the_next_way():
    ways = {"1": list(reversed(FAKE_WAYS["1"])), "2": FAKE_WAYS["2"]}
    built = build_leg(osm_leg([1, 2], 0, 4, true_length(0, 4)), ways)
    assert built.coordinates == [pt(i) for i in range(5)]


def test_clip_points_in_reversed_order_reverse_the_line():
    built = build_leg(osm_leg([1, 2], 4, 0, true_length(0, 4)), FAKE_WAYS)
    assert built.coordinates == [pt(i) for i in range(4, -1, -1)]


def test_declared_gap_is_bridged_and_included_in_length():
    gap_m = line_length_m([pt(6), (pt(6)[0] + 0.0003, LAT)])
    expected = true_length(4, 6) + gap_m + line_length_m([(pt(6)[0] + 0.0003, LAT), pt(7)])
    leg = LegSpec(
        street="Fake Street",
        method="osm+gap",
        length_m=expected,
        osm_ways=[3, "gap", 4],
        clip_from_lonlat=pt(4),
        clip_to_lonlat=pt(7),
        bridged_gaps_m=[gap_m],
    )
    built = build_leg(leg, FAKE_WAYS)
    assert built.length_m == pytest.approx(expected)
    assert built.method == "osm+gap"


def test_declared_gap_with_wrong_distance_raises():
    leg = LegSpec(
        street="Fake Street",
        method="osm+gap",
        length_m=300.0,
        osm_ways=[3, "gap", 4],
        clip_from_lonlat=pt(4),
        clip_to_lonlat=pt(7),
        bridged_gaps_m=[5.0],
    )
    with pytest.raises(RouteError, match="Bridged gap"):
        build_leg(leg, FAKE_WAYS)


def test_undeclared_break_raises_and_names_the_street():
    leg = osm_leg([3, 4], 4, 7, 300.0)
    with pytest.raises(RouteError, match="Undeclared break in Fake Street"):
        build_leg(leg, FAKE_WAYS)


def test_length_mismatch_raises_with_actual_and_expected():
    leg = osm_leg([1, 2], 0, 4, true_length(0, 4) + 50.0)
    with pytest.raises(RouteError, match="Length mismatch in Fake Street"):
        build_leg(leg, FAKE_WAYS)


def test_length_within_tolerance_is_accepted():
    validate_leg_length(1000.0, 1004.0)  # 0.5% of 1004 is 5.02 m
    validate_leg_length(10.0, 10.9)  # 1 m floor
    with pytest.raises(RouteError):
        validate_leg_length(1000.0, 1006.0)
    with pytest.raises(RouteError):
        validate_leg_length(10.0, 11.5)


def test_equal_clip_vertices_raise():
    leg = osm_leg([1, 2], 2, 2, 0.0)
    with pytest.raises(RouteError, match="same vertex"):
        build_leg(leg, FAKE_WAYS)


def test_clip_line_equal_vertices_raise():
    with pytest.raises(RouteError, match="same vertex"):
        clip_line([pt(0), pt(1), pt(2)], pt(1), pt(1))


def test_clip_line_picks_nearest_vertices():
    line = [pt(i) for i in range(5)]
    near_1 = (pt(1)[0] + 0.00001, LAT)
    near_3 = (pt(3)[0] - 0.00001, LAT)
    assert clip_line(line, near_1, near_3) == [pt(1), pt(2), pt(3)]


def test_orient_way_flips_when_last_point_is_nearer_the_reference_end():
    ref = [pt(0), pt(1), pt(2)]
    assert orient_way([pt(4), pt(3), pt(2)], ref) == [pt(2), pt(3), pt(4)]
    assert orient_way([pt(2), pt(3), pt(4)], ref) == [pt(2), pt(3), pt(4)]


def test_missing_way_id_raises_named_error_in_build_leg():
    leg = osm_leg([1, 99], 0, 4, 100.0)
    with pytest.raises(RouteError, match="99"):
        build_leg(leg, FAKE_WAYS)


def _write_ways(tmp_path, ways):
    p = tmp_path / "ways.json"
    p.write_text(json.dumps({"schema": "fake", "download_date": "2000-01-01", "ways": ways}), encoding="utf-8")
    return p


def test_load_ways_reads_snapshot(tmp_path):
    p = _write_ways(tmp_path, {"1": [[-76.62, 39.3], [-76.619, 39.3]]})
    assert load_ways(p) == {"1": [(-76.62, 39.3), (-76.619, 39.3)]}


def test_load_ways_missing_id_raises_named_error(tmp_path):
    facts = load_facts(FIXTURE_FACTS)
    facts.legs["eastbound"][0] = osm_leg([123456789], 0, 1, 10.0)
    p = _write_ways(tmp_path, {"1": [[-76.62, 39.3], [-76.619, 39.3]]})
    with pytest.raises(RouteError, match="123456789"):
        load_ways(p, facts)


def test_load_ways_missing_file_raises(tmp_path):
    with pytest.raises(RouteError, match="not found"):
        load_ways(tmp_path / "nope.json")


def test_build_route_on_fake_facts_returns_two_lines():
    facts = load_facts(FIXTURE_FACTS)
    route = build_route(facts, {})
    assert set(route) == {"westbound", "eastbound"}
    assert [leg.direction for leg in route["westbound"]] == ["westbound"]
    assert [leg.direction for leg in route["eastbound"]] == ["eastbound"]


def test_validate_route_joins_rejects_a_break():
    a = build_leg(LegSpec("A", "inferred", true_length(0, 1), points_lonlat=[pt(0), pt(1)], note="x"), {})
    b = build_leg(LegSpec("B", "inferred", true_length(3, 4), points_lonlat=[pt(3), pt(4)], note="x"), {})
    with pytest.raises(RouteError, match="do not join"):
        validate_route_joins([a, b])


def test_validate_timing_points_rejects_a_far_point():
    facts = load_facts(FIXTURE_FACTS)
    leg = build_leg(LegSpec("A", "inferred", true_length(0, 1), points_lonlat=[pt(0), pt(1)], note="x"), {})
    far = facts.timing_points[0]
    far.lonlat = (-76.620, LAT + 0.01)  # about 1.1 km north
    with pytest.raises(RouteError, match="from the route"):
        validate_timing_points([leg], [far])
