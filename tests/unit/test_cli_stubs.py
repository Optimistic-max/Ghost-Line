"""Unit tests: every not-yet-implemented CLI stub must exit non-zero, and the CLI surface is five commands."""

import tomllib
from pathlib import Path
from unittest.mock import patch

import pytest

from pipeline import cli

FIVE_COMMANDS = ["validate", "build", "check", "verify", "check_sources"]
ROOT = Path(__file__).resolve().parents[2]


def run_main(argv, capsys):
    """Run cli.main() with argv; return (exit code, stdout, stderr)."""
    with patch("sys.argv", ["pipeline", *argv]):
        with pytest.raises(SystemExit) as exc_info:
            cli.main()
    out = capsys.readouterr()
    return exc_info.value.code, out.out, out.err


def test_no_command_is_a_stub_any_more():
    """All five commands are implemented (tasks 20 to 24); none may print the stub message."""
    import inspect

    for name in FIVE_COMMANDS:
        handler = getattr(cli, f"cmd_{name}")
        assert "not yet implemented" not in inspect.getsource(handler).lower(), name


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
