"""
Step 1: validate the pinned GTFS feed.

Computes the SHA-256 of the feed zip and compares it with the pinned value.
Never downloads anything and never touches the network.
"""

import hashlib
from pathlib import Path

from pipeline.errors import FeedError

PINNED_FEED_SHA256 = "8cc37d54d3a360979a6bcc70038b6f532a1e6475041ad970bdaafde34ab3f694"

_CHUNK_SIZE = 1 << 20


def compute_sha256(file_path: Path) -> str:
    """Return the hex SHA-256 of a file, read in chunks."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(_CHUNK_SIZE), b""):
            h.update(chunk)
    return h.hexdigest()


def check_feed(feed_path: Path, expected_sha256: str = PINNED_FEED_SHA256) -> str:
    """
    Validate that the feed file exists and matches the pinned SHA-256.

    Returns: the feed SHA-256 hash.
    Raises: FeedError if the file is missing or the hash differs.
    """
    feed_path = Path(feed_path)
    if not feed_path.is_file():
        raise FeedError(
            "raw/mta_local_bus.zip not found. "
            "Place the pinned GTFS feed at this path. "
            f"(looked for: {feed_path})"
        )
    actual = compute_sha256(feed_path)
    if actual != expected_sha256:
        raise FeedError(
            "SHA-256 mismatch. "
            f"Expected: {expected_sha256} "
            f"Actual: {actual}"
        )
    return actual
