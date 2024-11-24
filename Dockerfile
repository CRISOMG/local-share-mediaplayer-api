FROM node:20.18

RUN apt-get update 
RUN apt-get install -y ffmpeg
# RUN apt-get install -y htop
RUN rm -rf /var/lib/apt/lists/*

WORKDIR /api
VOLUME '/api'
COPY ./api/package.json ./
COPY ./api/yarn.lock ./
RUN yarn global add pm2
RUN yarn install
EXPOSE 3002

# CMD ["yarn","dev"]
# CMD ["pm2-runtime", "start", "/api/ecosystem.config.cjs"]