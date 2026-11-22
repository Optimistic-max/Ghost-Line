"""Protocol test for the MCP server over stdio (R1.4, R5.4, R9.6).

Marked needs_mcp_sdk. It skips only when the SDK is not installed (tests/conftest.py
does that, with a warning). Where the SDK is installed it must run: there is no
skip, skipif or xfail in this file, and a skipped run fails the pytest session.

The server is pointed at a zip that does not exist, so the test needs no real feed
and runs in check --quick too. That also proves the server fails closed on the wire.
"""

import json

import pytest

from tests.mcp_stdio import StdioServer

pytestmark = pytest.mark.needs_mcp_sdk

TOOLS = {"feed_info", "trips_serving"}


def text_of(result: dict) -> str:
    return " ".join(part.get("text", "") for part in result.get("content", []))


def test_handshake_and_tool_list_over_stdio_with_nothing_else_on_stdout(tmp_path):
    with StdioServer(tmp_path / "no-such-feed.zip") as server:
        reply = server.initialize()
        assert reply["result"]["serverInfo"]["name"] == "ghostline-gtfs"
        tools = server.request("tools/list")["result"]["tools"]
        assert {t["name"] for t in tools} == TOOLS
        by_name = {t["name"]: t for t in tools}
        assert set(by_name["trips_serving"]["inputSchema"]["required"]) == {"stop_a", "stop_b", "date"}
        assert "after" in by_name["trips_serving"]["inputSchema"]["properties"]
        sent = list(server.stdout_lines)
    assert sent, "the server wrote nothing"
    for line in sent:
        message = json.loads(line)  # every line of standard output must be a JSON message
        assert message.get("jsonrpc") == "2.0", line
        assert "id" in message or "method" in message, line


def test_a_missing_feed_is_an_error_on_the_wire_never_an_empty_answer(tmp_path):
    missing = tmp_path / "no-such-feed.zip"
    with StdioServer(missing) as server:
        server.initialize()
        info = server.call("feed_info")
        trips = server.call("trips_serving", {"stop_a": "A", "stop_b": "B", "date": "2026-11-04"})
    for result in (info, trips):
        assert result["isError"] is True
        assert "not found" in text_of(result)
        assert str(missing) in text_of(result)
        assert "count" not in text_of(result)


def test_standard_output_holds_no_log_lines(tmp_path):
    with StdioServer(tmp_path / "no-such-feed.zip") as server:
        server.initialize()
        server.call("feed_info")
        out = "".join(server.stdout_lines)
    assert "ghostline-gtfs:" not in out
