"""A tiny stdio client for the MCP server, for tests. Newline-delimited JSON-RPC.

It records every line the server writes to standard output, so tests can check
that nothing but protocol messages is there.
"""

import json
import os
import queue
import subprocess
import sys
import threading
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


class StdioServer:
    def __init__(self, zip_path: str, extra_env: dict | None = None):
        env = {**os.environ, "GHOSTLINE_GTFS_ZIP": str(zip_path), "PYTHONUNBUFFERED": "1", **(extra_env or {})}
        self.proc = subprocess.Popen(
            [sys.executable, "-m", "pipeline.mcp_server"],
            cwd=str(REPO),
            env=env,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
        )
        self.stdout_lines: list[str] = []
        self.stderr_text = ""
        self._queue: queue.Queue = queue.Queue()
        self._next_id = 0
        threading.Thread(target=self._pump_stdout, daemon=True).start()
        threading.Thread(target=self._pump_stderr, daemon=True).start()

    def _pump_stdout(self):
        for line in self.proc.stdout:
            self.stdout_lines.append(line)
            self._queue.put(line)

    def _pump_stderr(self):
        for line in self.proc.stderr:
            self.stderr_text += line

    def _send(self, message: dict):
        self.proc.stdin.write(json.dumps(message) + "\n")
        self.proc.stdin.flush()

    def request(self, method: str, params: dict | None = None, timeout: float = 30) -> dict:
        self._next_id += 1
        request_id = self._next_id
        self._send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}})
        while True:
            try:
                line = self._queue.get(timeout=timeout)
            except queue.Empty:
                raise TimeoutError(f"no answer to {method} within {timeout}s; stderr: {self.stderr_text[-500:]}")
            message = json.loads(line)
            if message.get("id") == request_id:
                return message

    def notify(self, method: str, params: dict | None = None):
        self._send({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def initialize(self) -> dict:
        reply = self.request(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "ghostline-tests", "version": "0"},
            },
        )
        self.notify("notifications/initialized")
        return reply

    def call(self, tool: str, arguments: dict | None = None, timeout: float = 30) -> dict:
        return self.request("tools/call", {"name": tool, "arguments": arguments or {}}, timeout=timeout)["result"]

    def close(self):
        try:
            self.proc.stdin.close()
        except OSError:
            pass
        try:
            self.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(timeout=10)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
