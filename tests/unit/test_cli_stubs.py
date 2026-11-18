"""Unit tests: every not-yet-implemented CLI stub must exit non-zero, and the CLI surface is five commands."""

import argparse
import tomllib
from pathlib import Path
from unittest.mock import patch

import pytest

from pipeline import cli

# Commands that are still stubs. A command leaves this list when its task is
# done: validate (task 20) is implemented and tested in test_cli_validate.py.
STUB_COMMANDS = [
    ("build",        cli.cmd_build),
    ("check",        cli.cmd_check),
    ("verify",       cli.cmd_verify),
    ("check_sources",cli.cmd_check_sources),
]

FIVE_COMMANDS = ["validate", "build", "check", "verify", "check_sources"]
ROOT = Path(__file__).resolve().parents[2]


def run_main(argv, capsys):
    """Run cli.main() with argv; return (exit code, stdout, stderr)."""
    with patch("sys.argv", ["pipeline", *argv]):
        with pytest.raises(SystemExit) as exc_info:
            cli.main()
    out = capsys.readouterr()
    return exc_info.value.code, out.out, out.err


@pytest.mark.parametrize("name,handler", STUB_COMMANDS, ids=[c[0] for c in STUB_COMMANDS])
def test_stub_exits_nonzero(name, handler, capsys):
    """Each stub handler must raise SystemExit with a non-zero code."""
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
    args = argparse.Namespace()
    with pytest.raises(SystemExit):
        handler(args)
    captured = capsys.readouterr()
    assert "not yet implemented" in captured.out.lower(), (
        f"cmd_{name} did not print a 'not yet implemented' message."
    )


def test_top_level_help_lists_five_commands_and_not_fetch_osm(capsys):
    code, out, _ = run_main(["--help"], capsys)
    assert code == 0
    for name in FIVE_COMMANDS:
        assert name in out
    assert "fetch_osm" not in out


def test_fetch_osm_is_unknown_command(capsys):
    code, _, err = run_main(["fetch_osm"], capsys)
    assert code == 2  # argparse's usage-error exit code
    assert "invalid choice" in err
    assert "fetch_osm" in err


def test_fetch_osm_handler_removed():
    assert not hasattr(cli, "cmd_fetch_osm")


def test_check_sources_help_states_prose_paths_exclusions_and_json(capsys):
    code, out, _ = run_main(["check_sources", "--help"], capsys)
    assert code == 0
    flat = " ".join(out.split())
    for path in ["web/index.html", "web/src/**", "docs/*.md", "README.md"]:
        assert path in flat
    for excluded in ["docs/planning", "node_modules", "dist", "web/public/data"]:
        assert excluded in flat
    for term in ["live", "real-time", "realtime", "arriving now", "right now"]:
        assert term in flat
    assert "Scheduled, not live." in flat
    # prose and JSON checks are described as separate checks
    assert "Prose check" in flat
    assert "JSON check" in flat
    assert "source mappings" in flat


def test_check_sources_docstring_states_the_same_contract():
    doc = " ".join(cli.cmd_check_sources.__doc__.split())
    for text in ["web/index.html", "web/src/**", "docs/*.md", "README.md",
                 "docs/planning", "node_modules", "dist", "web/public/data",
                 "Scheduled, not live.", "JSON check"]:
        assert text in doc


def test_dependency_list_excludes_requests():
    data = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    deps = data["project"]["dependencies"]
    assert not any(d.lower().startswith("requests") for d in deps)
    assert any(d.startswith("pandas") for d in deps)
