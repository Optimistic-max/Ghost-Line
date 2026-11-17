"""Step 4: stops near corners and walk estimates."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from pyproj import Geod

if TYPE_CHECKING:
    from pipeline.facts import TimingPoint
    from pipeline.gtfs_reader import GTFSReader

DETOUR_FACTOR = 1.3
WALK_SPEED_M_PER_S = 1.2
DEFAULT_STOP_RADIUS_M = 400.0

_GEOD = Geod(ellps="WGS84")


def geodesic_distance(lonlat1, lonlat2) -> float:
    """WGS84 geodesic distance in metres between two [lon, lat] points.

    Full precision, no rounding.
    """
    lon1, lat1 = lonlat1
    lon2, lat2 = lonlat2
    _, _, dist = _GEOD.inv(lon1, lat1, lon2, lat2)
    return float(dist)

def compute_walk_time(distance_m: float) -> float:
    """Walk time in minutes for a geodesic distance in metres.

    This is an estimate: metres x DETOUR_FACTOR / WALK_SPEED_M_PER_S / 60.
    Full precision, no rounding. Rounding happens only in emit.
    """
    return distance_m * DETOUR_FACTOR / WALK_SPEED_M_PER_S / 60


@dataclass(frozen=True)
class Stop:
    """A GTFS stop near a corner. All values at full precision.

    walk_m is the WGS84 geodesic distance from the corner; walk_min is the
    walk-time estimate for that distance.
    """

    stop_id: str
    name: str
    lonlat: tuple[float, float]  # [lon, lat]
    walk_m: float
    walk_min: float


def find_stops_near_corners(
    gtfs: "GTFSReader",
    corners: "list[TimingPoint]",
    radius_m: float = DEFAULT_STOP_RADIUS_M,
) -> dict[str, list[Stop]]:
    """Find GTFS stops within radius_m of each corner.

    Returns {corner_slug: [Stop, ...]}, each list sorted by (walk_m, stop_id).
    A stop is included when its geodesic distance is <= radius_m. Values are
    not rounded. Stops with a blank or non-numeric lat/lon are skipped.
    """
    table = gtfs.read_table("stops.txt")
    candidates: list[tuple[str, str, tuple[float, float]]] = []
    for stop_id, name, lat, lon in zip(
        table["stop_id"], table["stop_name"], table["stop_lat"], table["stop_lon"]
    ):
        try:
            lonlat = (float(lon), float(lat))
        except (TypeError, ValueError):
            continue
        candidates.append((stop_id, name, lonlat))

    result: dict[str, list[Stop]] = {}
    for corner in corners:
        near: list[Stop] = []
        for stop_id, name, lonlat in candidates:
            dist = geodesic_distance(corner.lonlat, lonlat)
            if dist <= radius_m:
                near.append(Stop(stop_id, name, lonlat, dist, compute_walk_time(dist)))
        near.sort(key=lambda s: (s.walk_m, s.stop_id))
        result[corner.slug] = near
    return result
