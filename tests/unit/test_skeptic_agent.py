"""Tests for the Kiro wiring of the Skeptic and its permissions (R6.1 to R6.6, R7.10)."""

import importlib.util
import json
import re
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
AGENT = REPO / ".kiro" / "agents" / "skeptic.md"
STEERING = REPO / ".kiro" / "steering" / "skeptic-check.md"
MCP_JSON = REPO / ".kiro" / "settings" / "mcp.json"
GITIGNORE = REPO / ".gitignore"
TOKENS = REPO / "tests" / "golden" / "golden_tokens.py"

SERVER_NAME = "ghostline-gtfs"


def front_matter(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n(.*)$", text, re.DOTALL)
    assert match, f"{path.name} has no YAML front matter"
    return yaml.safe_load(match.group(1)), match.group(2)


def test_agent_is_named_skeptic_and_described_as_read_only():
    meta, body = front_matter(AGENT)
    assert meta["name"] == "skeptic"
    description = meta["description"]
    assert "Read-only" in description and "OK, MISMATCH or UNSOURCED" in description
    assert body.strip()


def test_agent_tools_are_read_and_the_server_only():
    meta, _ = front_matter(AGENT)
    tools = meta["tools"]
    assert isinstance(tools, list) and tools[0] == "read"
    # "@mcp" is allowed only as the documented fallback (R6.4); the default is the one server.
    assert tools[1:] in (["@" + SERVER_NAME], ["@mcp"]), tools


def test_agent_has_no_write_and_no_shell_tool():
    meta, _ = front_matter(AGENT)
    tools = {str(t).lower() for t in meta["tools"]}
    assert not tools & {"write", "shell", "web", "spec", "@builtin", "@powers"}, tools
    assert all(t == "read" or t.startswith("@") for t in tools)
    assert not any(t in ("write", "shell") for t in tools)
    assert "includeMcpJson" not in meta or meta["includeMcpJson"] is not True


def test_agent_instructions_forbid_editing_guessing_and_inventing_numbers():
    _, body = front_matter(AGENT)
    lowered = body.lower()
    for phrase in ("never edit", "never guess", "never propose a replacement number"):
        assert phrase in lowered, phrase
    for word in ("PASS", "FAIL:", "MISMATCH", "UNSOURCED", "OK"):
        assert word in body


def test_agent_names_the_evidence_files_in_order():
    _, body = front_matter(AGENT)
    body = body[body.index("## Evidence") : body.index("## Output")]
    order = [
        "web/public/data/index.json",
        "data/lines/no21-1938.yaml",
        "web/src/copy/copy.ts",
        "docs/kiro-usage.md",
        "ghostline-gtfs",
    ]
    positions = [body.index(item) for item in order]
    assert positions == sorted(positions)


def test_steering_file_is_manual_and_names_the_agent():
    meta, body = front_matter(STEERING)
    assert meta == {"inclusion": "manual"}
    assert "skeptic" in body and "docs/video_script.md" in body and "docs/devpost.md" in body
    assert "unchanged" in body


def test_mcp_json_registers_the_server_exactly_as_specified():
    entry = json.loads(MCP_JSON.read_text(encoding="utf-8"))["mcpServers"][SERVER_NAME]
    assert entry == {
        "command": "python",
        "args": ["-m", "pipeline.mcp_server"],
        "env": {"GHOSTLINE_GTFS_ZIP": "raw/mta_local_bus.zip"},
        "disabled": False,
    }


def test_kiro_is_never_in_gitignore():
    lines = [ln.strip() for ln in GITIGNORE.read_text(encoding="utf-8").splitlines()]
    assert not [ln for ln in lines if ln and not ln.startswith("#") and ln.strip("/!*").startswith(".kiro")]


def test_no_golden_value_in_the_agent_or_the_steering_file():
    spec = importlib.util.spec_from_file_location("golden_tokens", TOKENS)
    tokens = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tokens)
    for path in (AGENT, STEERING):
        text = path.read_text(encoding="utf-8")
        found = [
            t
            for t in tokens.FORBIDDEN_IN_SERVER_AND_AGENT
            if re.search(rf"(?<![\w.:]){re.escape(t)}(?![\w.:])", text)
        ]
        assert found == [], f"{path.name} holds golden values: {found}"
