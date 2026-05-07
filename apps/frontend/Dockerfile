FROM node:20-alpine AS builder

WORKDIR /workspace

COPY package*.json ./
RUN npm ci

COPY apps/frontend/ ./apps/frontend/

WORKDIR /workspace/apps/frontend
RUN node /workspace/node_modules/.bin/vite build

FROM nginx:alpine

COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html

RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / { try_files $uri $uri/ /index.html; }\n\
    location /api/ { proxy_pass http://backend:8000; }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
