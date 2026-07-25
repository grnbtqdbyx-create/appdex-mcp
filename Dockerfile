# Appdex MCP server — stdio transport.
# Build:  docker build -t appdex-mcp .
# Run:    docker run -i --rm -e APPDEX_API_KEY=adx_... appdex-mcp
FROM node:20-alpine

WORKDIR /app

# Bağımlılıklar önce → katman önbelleği korunur
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./

# stdio transport: konteyner STDIN/STDOUT üzerinden konuşur (docker run -i)
ENTRYPOINT ["node", "server.mjs"]
