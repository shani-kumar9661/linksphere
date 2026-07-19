# Stage 1: Build React/Vite App
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install all dependencies (including devDependencies like Vite to run build)
RUN npm ci

# Copy client codebase
COPY . .

# Build Vite application (creates dist/ folder)
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:1.25-alpine

# Copy custom client Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build files from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
