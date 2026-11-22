# MCP Python SDK notes (skeptic spec, task 1.1)

Read on Nov 22, 2026, official sources only. Content is paraphrased.

## Sources

- https://py.sdk.modelcontextprotocol.io/get-started/installation/ (current stable line is v2; Python 3.11+)
- https://github.com/modelcontextprotocol/python-sdk/blob/v1.x/README.md (v1.x is the maintenance line)
- https://py.sdk.modelcontextprotocol.io/v1/server/ (v1 server docs: tools, error handling, structured output)
- https://pypi.org/project/mcp/1.28.1/ (v1 quickstart)

## Findings

1. **Version line.** v2 is now the current stable release and a plain `pip install mcp` installs 2.x. v1.x is a maintenance line with security fixes. The spec pins `mcp>=1.27,<2` (approved by Emmanuel), which stays on 1.x. The docs advise a `<2` bound for projects not ready to migrate. The v1 docs live under /v1/.
2. **Python.** The SDK requires Python 3.11 or later. Python 3.14 is not listed by the classifiers; the import check in task 2.1 settles it.
3. **Server API (1.x).** `from mcp.server.fastmcp import FastMCP`; `FastMCP("name")`; tools are registered with `@server.tool()`; run with `server.run(transport="stdio")`. The design's section 2.8 sketch matches.
4. **Tool errors.** Unhandled exceptions raised in a tool are caught and returned as an error result with `isError=True`, and the message reaches the client. `ToolError` from `mcp.server.fastmcp.exceptions` is the documented way to signal expected errors. Returning `CallToolResult(isError=True)` gives full control. Design 2.7 (raise a ValueError subclass, do not catch) fits. The protocol test (task 9.1) still proves it on the wire. No behaviour differs from the design.
5. **Structured output.** A tool's return annotation decides whether the result is structured. Supported: Pydantic models, TypedDicts, dataclasses, `dict[str, T]`. A bare `dict` is not listed, so annotate returns as `dict[str, Any]`.
6. **stdout.** The stdio transport carries protocol messages on standard output, so nothing else may write there. Logging goes to standard error (design 2.8). The protocol test checks it.
7. **Tests.** The docs mention an in-memory transport for tests. The spec's protocol test uses a real subprocess, as designed (R9.6).

## Differences from design section 2.8

- Annotate tool returns as `dict[str, Any]`, not `dict`.
- Nothing else.