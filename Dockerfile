FROM nginx:alpine

COPY trailforkd.html /usr/share/nginx/html/index.html
COPY trailforkd.js /usr/share/nginx/html/trailforkd.js
COPY nginx/viewer.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
