FROM node:20-alpine

# Install curl for health check support
RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy codebase
COPY src/ ./src/

# Expose server port (configured via PORT env, defaults to 5000)
EXPOSE 5000

CMD ["node", "src/server.js"]
