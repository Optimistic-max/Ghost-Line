"""Unit tests: every not-yet-implemented CLI stub must exit non-zero."""

import pytest
from unittest.mock import patch

from pipeline import cli

STUB_COMMANDS = [
    ("fetch_osm",    cli.cmd_fetch_osm),
    ("validate",     cli.cmd_validate),
    ("build",        cli.cmd_build),
    ("check",        cli.cmd_check),
    ("verify",       cli.cmd_verify),
    ("check_sources",cli.cmd_check_sources),
]

@pytest.mark.parametrize("name,handler", STUB_COMMANDS, ids=[c[0] for c in STUB_COMMANDS])
def test_stub_exits_nonzero(name, handler, capsys):
    """Each stub handler must raise SystemExit with a non-zero code."""
    import argparse
    args = argparse.Namespace()
    with pytest.raises(SystemExit) as exc_info:
        handler(args)
    assert exc_info.value.code != 0, (
        f"cmd_{name} exited with 0 — stubs must exit non-zero so hooks "
        "cannot mistake an unbuilt command for a passing check."
    )


@pytest.mark.parametrize("name,handler", STUB_COMMANDS, ids=[c[0] for c in STUB_COMMANDS])
def test_stub_prints_not_implemented(name, handler, capsys):
    """Each stub must print a 'not yet implemented' message before exiting."""
    import argparse
    args = argparse.Namespace()
    with pytest.raises(SystemExit):
        handler(args)
    captured = capsys.readouterr()
    assert "not yet implemented" in captured.out.lower(), (
        f"cmd_{name} did not print a 'not yet implemented' message."
    )
