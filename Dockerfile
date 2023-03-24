FROM node:14
WORKDIR /app
COPY app/package.json .
RUN npm cache clean --force
# RUN npm install

ARG NODE_ENV
RUN if [ "$NODE_ENV" = "development" ]; \
        then npm install; \
        else npm install --only=production;\
        fi

COPY app/. ./
ENV PORT 3000
EXPOSE $PORT
CMD ["node", "index.js"]