"""Independence and hygiene tests for pipeline/mcp_server.py (R1.5, R1.6, R2.1, R2.2, R2.5, R7.10).

The server checks the pipeline's output, so it must share no code with it. These
tests read its source with the ast module and never run it.
"""

import ast
import importlib.util
import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SERVER = REPO / "pipeline" / "mcp_server.py"
TOKENS = REPO / "tests" / "golden" / "golden_tokens.py"

NETWORK_MODULES = {"socket", "ssl", "urllib", "http", "httpx", "requests", "aiohttp", "ftplib", "smtplib", "xmlrpc", "asyncio"}
STANDARD_TOP_LEVEL = {"csv", "datetime", "hashlib", "io", "logging", "os", "re", "sys", "threading", "zipfile", "dataclasses", "pathlib", "typing"}


def golden_tokens():
    spec = importlib.util.spec_from_file_location("golden_tokens", TOKENS)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def tree():
    return ast.parse(SERVER.read_text(encoding="utf-8"))


def imported_modules(node_tree) -> list[tuple[str, int, int]]:
    """(module name, relative level, line) for every import in the file, at any depth."""
    found = []
    for node in ast.walk(node_tree):
        if isinstance(node, ast.Import):
            found += [(alias.name, 0, node.lineno) for alias in node.names]
        elif isinstance(node, ast.ImportFrom):
            found.append((node.module or "", node.level, node.lineno))
    return found


def test_the_server_imports_no_pipeline_module():
    bad = [
        (name, line)
        for name, level, line in imported_modules(tree())
        if level > 0 or name == "pipeline" or name.startswith("pipeline.")
    ]
    assert bad == [], f"pipeline/mcp_server.py must not import pipeline modules: {bad}"


def test_the_scan_would_catch_a_pipeline_import():
    sample = ast.parse("import pipeline.race\nfrom pipeline import eligible\nfrom . import stops\ndef f():\n    from pipeline.emit import x\n")
    found = [(n, lvl) for n, lvl, _ in imported_modules(sample)]
    assert ("pipeline.race", 0) in found and ("pipeline", 0) in found and ("", 1) in found and ("pipeline.emit", 0) in found


def test_module_level_imports_are_standard_library_and_the_sdk_comes_in_a_function():
    top_level = set()
    for node in tree().body:
        if isinstance(node, ast.Import):
            top_level |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom):
            top_level.add((node.module or "").split(".")[0])
    assert "mcp" not in top_level, "the SDK must be imported inside build_server(), not at module level"
    assert top_level <= STANDARD_TOP_LEVEL, f"unexpected module-level imports: {top_level - STANDARD_TOP_LEVEL}"
    assert [n for n, _, _ in imported_modules(tree()) if n == "mcp" or n.startswith("mcp.")] == ["mcp.server.fastmcp"]


def test_the_server_imports_no_network_module():
    names = {name.split(".")[0] for name, _, _ in imported_modules(tree())}
    assert not (names & NETWORK_MODULES), names & NETWORK_MODULES


def test_the_server_never_prints_or_touches_standard_output():
    calls = [n for n in ast.walk(tree()) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == "print"]
    assert calls == [], "print() would corrupt the protocol stream"
    source = SERVER.read_text(encoding="utf-8")
    assert "sys.stdout" not in source and "sys.__stdout__" not in source


def test_the_server_never_opens_a_file_for_writing():
    writers = {"write_text", "write_bytes", "mkdir", "touch", "unlink", "rename", "replace", "rmdir", "remove", "makedirs", "mkstemp"}
    for node in ast.walk(tree()):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.id if isinstance(func, ast.Name) else func.attr if isinstance(func, ast.Attribute) else ""
        if name in writers:
            pytest.fail(f"line {node.lineno}: {name}() writes to disk")
        if name == "open":
            modes = [a.value for a in node.args[1:2] if isinstance(a, ast.Constant)]
            modes += [k.value.value for k in node.keywords if k.arg == "mode" and isinstance(k.value, ast.Constant)]
            for mode in modes:
                assert not set(str(mode)) & set("wax+"), f"line {node.lineno}: open() in mode {mode!r}"


def test_the_server_starts_no_process_and_opens_no_connection():
    source = SERVER.read_text(encoding="utf-8")
    for word in ("subprocess", "urlopen", "requests.", "socket."):
        assert word not in source, word


def test_the_pinned_hash_equals_the_pipelines_pinned_hash():
    from pipeline import feed_check, mcp_server

    assert mcp_server.PINNED_SHA256 == feed_check.PINNED_FEED_SHA256


def test_the_pinned_hash_is_a_literal_not_an_import():
    assigned = [n for n in tree().body if isinstance(n, ast.Assign) and any(getattr(t, "id", "") == "PINNED_SHA256" for t in n.targets)]
    assert len(assigned) == 1 and isinstance(assigned[0].value, ast.Constant)


def present(token: str, text: str) -> bool:
    return re.search(rf"(?<![\w.:]){re.escape(token)}(?![\w.:])", text) is not None


def test_no_golden_value_appears_in_the_server():
    text = SERVER.read_text(encoding="utf-8")
    found = [t for t in golden_tokens().FORBIDDEN_IN_SERVER_AND_AGENT if present(t, text)]
    assert found == [], f"golden values must not appear in the server: {found}"


def test_the_token_check_would_catch_a_planted_golden_value():
    tokens = golden_tokens().FORBIDDEN_IN_SERVER_AND_AGENT
    assert all(present(t, f"x = '{t}'\n") for t in tokens)
    assert not present("36", "PINNED = 'a360f'; seconds = 3600")
