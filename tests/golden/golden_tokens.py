"""Golden values for the MCP server (skeptic spec), written down once.

They are test targets only. They must never appear in pipeline/mcp_server.py, in
.kiro/agents/skeptic.md or in .kiro/steering/skeptic-check.md (P-D, R7.10). The
independence tests read FORBIDDEN_IN_SERVER_AND_AGENT from here so that check
runs even when raw/ is missing. This module reads no feed.

If the server computes a value that differs from one of these, stop and tell
Emmanuel. Never edit a value here to make a check pass.
"""

STOP_A = "8564"  # Biddle St & Caroline Ave
STOP_B = "9486"  # Caroline St & Eastern Ave
SERVICE_DATE = "2026-11-04"
FEED_VERSION = "20260821"
ACTIVE_SERVICE_IDS = ["2251"]
ROUTE_SHORT_NAME = "CityLink LIME"
HEADSIGN = "HARBOR EAST"

TRIP_COUNT = 36
WINDOW_AFTER, WINDOW_BEFORE = "10:00", "13:00"
WINDOW_DEPARTURES = ["10:32:43", "11:08:43", "11:44:43", "12:20:43", "12:56:43"]
WINDOW_COUNT = len(WINDOW_DEPARTURES)
FIRST_OF_DAY = ("04:37:28", "04:44:00")
LAST_OF_DAY = ("25:15:53", "25:23:00")

# Whole-token strings that must not appear in the server, the agent or the steering file.
FORBIDDEN_IN_SERVER_AND_AGENT = (
    STOP_A,
    STOP_B,
    FEED_VERSION,
    *ACTIVE_SERVICE_IDS,
    str(TRIP_COUNT),
    *WINDOW_DEPARTURES,
    *FIRST_OF_DAY,
    *LAST_OF_DAY,
)
