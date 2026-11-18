"""
GTFS zip reader utilities.

Reads named .txt files from a GTFS zip as pandas DataFrames (all columns kept
as strings, so GTFS times stay HH:MM:SS). Offers a cache of the service-date
rows of stop_times under raw/cache/ and a parser from HH:MM:SS to minutes
after midnight.
"""

from __future__ import annotations

import hashlib
import io
import logging
import re
import zipfile
from pathlib import Path
from typing import Iterable

import pandas as pd

from pipeline.errors import FeedError

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = Path("raw") / "cache"

_TIME_RE = re.compile(r"^\s*(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)\s*$")


def parse_gtfs_time(value: str) -> float:
    """Convert a GTFS HH:MM:SS string to minutes after midnight.

    Hours may be 24 or more ("25:10:00" -> 1510.0). No rounding.
    """
    if not isinstance(value, str):
        raise ValueError(f"GTFS time must be a string, got {value!r}")
    m = _TIME_RE.match(value)
    if m is None:
        raise ValueError(f"Invalid GTFS time: {value!r}")
    return int(m.group(1)) * 60 + int(m.group(2)) + float(m.group(3)) / 60.0


def _is_blank(series: pd.Series) -> pd.Series:
    return series.isna() | (series.astype(str).str.strip() == "")


class GTFSReader:
    """Reads files from a GTFS zip. Never touches the network."""

    def __init__(self, zip_path: str | Path, cache_dir: str | Path | None = None):
        self.zip_path = Path(zip_path)
        self.cache_dir = Path(cache_dir) if cache_dir is not None else DEFAULT_CACHE_DIR
        if not self.zip_path.is_file():
            raise FeedError(f"GTFS feed not found: {self.zip_path}")
        try:
            with zipfile.ZipFile(self.zip_path) as zf:
                self._names = set(zf.namelist())
        except zipfile.BadZipFile as exc:
            raise FeedError(f"GTFS feed is not a valid zip: {self.zip_path}") from exc
        self._sha256: str | None = None

    @property
    def sha256(self) -> str:
        if self._sha256 is None:
            h = hashlib.sha256()
            with open(self.zip_path, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
            self._sha256 = h.hexdigest()
        return self._sha256

    def has_file(self, name: str) -> bool:
        return name in self._names

    def read_table(self, name: str) -> pd.DataFrame:
        """Read one txt file (e.g. "stops.txt") as an all-string DataFrame."""
        if name not in self._names:
            raise FeedError(f"GTFS file {name!r} is missing from {self.zip_path}")
        with zipfile.ZipFile(self.zip_path) as zf:
            raw = zf.read(name)
        return pd.read_csv(
            io.BytesIO(raw),
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
        )

    def read_stop_times(
        self,
        service_date: str | None = None,
        trip_ids: Iterable[str] | None = None,
        use_cache: bool = True,
    ) -> pd.DataFrame:
        """Read stop_times.txt, skipping rows with blank arrival and departure.

        Each skipped row is logged. With service_date, the rows for that date
        (restricted to trip_ids) are cached at
        <cache_dir>/<sha256[:12]>_<service_date>.csv. On a cache miss trip_ids
        is required. use_cache=False bypasses the cache (neither read nor
        written).
        """
        if service_date is None:
            df = self.read_table("stop_times.txt")
            if trip_ids is not None:
                df = df[df["trip_id"].isin(set(trip_ids))]
            return self._drop_blank_times(df)

        path = self.cache_path(service_date)
        wanted = set(trip_ids) if trip_ids is not None else None
        cached_ids: set[str] = set()
        if use_cache and path.is_file():
            cached = pd.read_csv(path, dtype=str, keep_default_na=False)
            cached_ids = set(cached["trip_id"])
            # A cache written before the blank-row rule existed may still hold
            # blank rows, so the rule is applied on every read.
            if wanted is None or wanted <= cached_ids:
                return self._drop_blank_times(cached).reset_index(drop=True)
            # The cache holds only some of the requested trips: rebuild it
            # from the zip with the union, so a call for other services is
            # never answered from a partial cache.
            wanted |= cached_ids

        if wanted is None:
            raise FeedError(
                "trip_ids are required to read stop_times for a service date "
                "when no cache file exists"
            )
        df = self.read_table("stop_times.txt")
        df = df[df["trip_id"].isin(wanted)]
        df = self._drop_blank_times(df).reset_index(drop=True)
        if use_cache:
            path.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(path, index=False, lineterminator="\n")
        return df

    def cache_path(self, service_date: str) -> Path:
        return self.cache_dir / f"{self.sha256[:12]}_{service_date}.csv"

    @staticmethod
    def _drop_blank_times(df: pd.DataFrame) -> pd.DataFrame:
        blank = _is_blank(df["arrival_time"]) & _is_blank(df["departure_time"])
        for _, row in df[blank].iterrows():
            logger.warning(
                "Skipping stop_times row with blank arrival_time and "
                "departure_time: trip_id=%s stop_id=%s stop_sequence=%s",
                row["trip_id"],
                row["stop_id"],
                row["stop_sequence"],
            )
        return df[~blank]
