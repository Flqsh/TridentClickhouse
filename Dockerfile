FROM node:22
WORKDIR /usr/src/app
COPY package*.json ./
RUN yarn
COPY . .
CMD NODE_OPTIONS="--max-old-space-size=20480" yarn start