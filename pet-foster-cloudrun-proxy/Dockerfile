FROM node:20-alpine
WORKDIR /app
COPY package.json index.js ./
ENV PORT=80
ENV UPSTREAM_ORIGIN=https://pet-foster-server.onrender.com
ENV PREHEAT_MS=600000
EXPOSE 80
CMD ["node", "index.js"]
