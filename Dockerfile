FROM nginx:alpine

# Add Node.js for the trail API
RUN apk add --no-cache nodejs npm

# Static frontend
COPY trailforkd.html /usr/share/nginx/html/index.html
COPY trailforkd.js /usr/share/nginx/html/trailforkd.js

# Trail API
COPY api/package*.json /app/
RUN cd /app && npm ci --only=production
COPY api/index.js /app/index.js

# nginx config
COPY nginx/viewer.conf /etc/nginx/conf.d/default.conf

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
