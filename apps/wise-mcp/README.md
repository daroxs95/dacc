# Wise MCP

Standalone Node.js 22+ app. From this directory, create a local `.env` file with
`WISE_API_TOKEN=<your read-only token>`. Set `PORT` there if you need a port
other than 4317.

```sh
npm install
npm start
```

Point a local Streamable HTTP MCP client at `http://127.0.0.1:4317/mcp`.
The server accepts requests from local clients without an Origin header.
The Wise token is configured on the server.

Call `wise_get` with a versioned API path and optional query parameters.
For example, list profiles with `{"path":"/2026Q4/profiles"}`.
The app forwards GET requests to `https://api.wise.com` and returns the
upstream HTTP status and body. The available data depends on the token and
account. See [Wise's personal API token documentation](https://docs.wise.com/guides/developer/auth-and-security/personal-api-token)
for balance statement availability by account country.
