# Base stage
FROM node:22-alpine AS base
RUN apk add --no-cache curl && npm install -g bun

# Build stage
FROM base AS builder

WORKDIR /app

# 1. Copy package files first
COPY package*.json bun.lockb* ./

# 2. Use bun for faster installation
RUN bun install

# 3. Copy the rest of the source code
COPY . .

# 4. Build the project
RUN bun run build

# Clean bun cache and remove source files to save space
RUN bun pm cache clean
# Note: Keeping dist and node_modules for the next stage

# Production stage
FROM base

WORKDIR /app

# Copy only the necessary files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Environment variables
ENV NODE_ENV=production

# Expose the application port (matching DEFAULT_PORT in app.constants.ts)
EXPOSE 3000

# Start the application
CMD ["node", "dist/main.js"]
