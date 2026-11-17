"""
Pipeline error types.

All pipeline failures raise one of these exceptions so callers
can catch specific failure modes without importing internal modules.
"""


class PipelineError(Exception):
    """Base exception for all pipeline errors."""


class FeedError(PipelineError):
    """Raised when the GTFS feed file is missing or its SHA-256 hash does not match the pinned value."""


class FactsError(PipelineError):
    """Raised when the facts YAML file is missing a required field or fails schema validation."""


class RouteError(PipelineError):
    """Raised when route reconstruction fails: undeclared OSM way break, length mismatch, or bad clip order."""


class ValidationError(PipelineError):
    """Raised when a generated output file fails JSON schema validation or contains an unsourced numeric field."""
