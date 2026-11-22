"""Golden tests for the MCP server on the pinned feed (R9.2, R9.3).

The values come from tests/golden/golden_tokens.py. They are recounts made with a
separate script (zipfile and csv only) and must not be edited to make a test pass:
if the server disagrees, stop and tell Emmanuel.

Marked requires_feed: skipped with a visible message when raw/mta_local_bus.zip is
missing (the hosted build).
"""

import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FEED_PATH = ROOT / "raw" / "mta_local_bus.zip"
if not FEED_PATH.is_file():
    pytest.skip(f"golden MCP server tests need {FEED_PATH}, which is missing: SKIPPED", allow_module_level=True)

pytestmark = pytest.mark.requires_feed

from pipeline import mcp_server as srv  # noqa: E402
from pipeline.feed_check import PINNED_FEED_SHA256, check_feed  # noqa: E402
from tests.mcp_stdio import StdioServer  # noqa: E402

_spec = importlib.util.spec_from_file_location("golden_tokens", ROOT / "tests" / "golden" / "golden_tokens.py")
G = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(G)

LEAD_RACE = ROOT / "web" / "public" / "data" / "race" / "preston-caroline__aliceanna-bond.json"


@pytest.fixture(scope="module")
def feed():
    loaded = srv.load_feed(FEED_PATH)
    assert loaded.error is None, loaded.error
    return loaded


def ask(feed, **kw):
    return srv.trips_serving_answer(feed, G.STOP_A, G.STOP_B, G.SERVICE_DATE, **kw)


def test_the_pipeline_and_the_server_agree_this_zip_is_the_pinned_feed(feed):
    assert check_feed(FEED_PATH) == PINNED_FEED_SHA256 == feed.sha256


def test_feed_info_on_the_pinned_feed(feed):
    answer = srv.feed_info_answer(feed)
    assert answer["feed_version"] == G.FEED_VERSION
    assert answer["sha256"] == PINNED_FEED_SHA256
    assert answer["service_date"] == G.SERVICE_DATE
    assert answer["active_service_ids"] == G.ACTIVE_SERVICE_IDS


def test_no_call_was_dropped_for_blank_times_on_the_pinned_feed(feed):
    # Design 2.4 step 8: a non-zero count is reported to Emmanuel, not ignored.
    assert feed.dropped_calls == 0, f"{feed.dropped_calls} call(s) with both times blank: tell Emmanuel"


def test_the_day_has_the_golden_number_of_one_seat_trips_all_on_the_lime(feed):
    answer = ask(feed)
    assert answer["count"] == G.TRIP_COUNT == len(answer["trips"])
    assert {t["route_short_name"] for t in answer["trips"]} == {G.ROUTE_SHORT_NAME}
    assert {t["headsign"] for t in answer["trips"]} == {G.HEADSIGN}


def test_the_first_and_last_trip_of_the_day_including_a_time_past_24(feed):
    trips = ask(feed)["trips"]
    assert (trips[0]["dep_a"], trips[0]["arr_b"]) == G.FIRST_OF_DAY
    assert (trips[-1]["dep_a"], trips[-1]["arr_b"]) == G.LAST_OF_DAY


def test_the_ten_to_one_window_has_the_golden_five_departures(feed):
    answer = ask(feed, after=G.WINDOW_AFTER, before=G.WINDOW_BEFORE)
    assert answer["count"] == G.WINDOW_COUNT
    assert [t["dep_a"] for t in answer["trips"]] == G.WINDOW_DEPARTURES


def test_the_lead_race_file_agrees_with_the_server_on_the_five_departures(feed):
    """The independence check: the pipeline's trip list and the server's own reader agree."""
    race = json.loads(LEAD_RACE.read_text(encoding="utf-8"))
    window = [
        t["dep"]
        for t in race["today"]["trips"]
        if f"{G.WINDOW_AFTER}:00" <= t["dep"] <= f"{G.WINDOW_BEFORE}:00"
    ]
    assert window == G.WINDOW_DEPARTURES
    assert window == [t["dep_a"] for t in ask(feed, after=G.WINDOW_AFTER, before=G.WINDOW_BEFORE)["trips"]]
    assert race["today"]["trips"][0]["board"]["stop_id"] == G.STOP_A
    assert race["today"]["trips"][0]["alight"]["stop_id"] == G.STOP_B


def tool_json(result: dict) -> dict:
    assert not result.get("isError"), result
    return json.loads(result["content"][0]["text"])


def call_with_retry(server, tool, arguments=None, attempts=4):
    """Bounded retry while the background load is still running."""
    for _ in range(attempts):
        result = server.call(tool, arguments, timeout=60)
        text = " ".join(part.get("text", "") for part in result.get("content", []))
        if result.get("isError") and text.startswith("feed still loading"):
            continue
        return result
    raise AssertionError(f"{tool}: the feed was still loading after {attempts} attempts")


def test_the_real_server_over_stdio_answers_with_the_real_feed():
    """The path Kiro uses: start the server, initialize, ask over stdio."""
    with StdioServer(FEED_PATH) as server:
        server.initialize()
        info = tool_json(call_with_retry(server, "feed_info"))
        window = tool_json(
            call_with_retry(
                server,
                "trips_serving",
                {"stop_a": G.STOP_A, "stop_b": G.STOP_B, "date": G.SERVICE_DATE, "after": G.WINDOW_AFTER, "before": G.WINDOW_BEFORE},
            )
        )
        wrong_date = server.call("trips_serving", {"stop_a": G.STOP_A, "stop_b": G.STOP_B, "date": "2026-11-05"})
        stdout = list(server.stdout_lines)
    assert info["feed_version"] == G.FEED_VERSION and info["sha256"] == PINNED_FEED_SHA256
    assert info["active_service_ids"] == G.ACTIVE_SERVICE_IDS
    assert window["count"] == G.WINDOW_COUNT
    assert [t["dep_a"] for t in window["trips"]] == G.WINDOW_DEPARTURES
    assert wrong_date["isError"] is True
    assert all(json.loads(line).get("jsonrpc") == "2.0" for line in stdout)
