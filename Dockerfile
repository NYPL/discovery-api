FROM node:10.24.1 as production

RUN apt-get update
RUN apt-get upgrade -y

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json ./
ENV NODE_ENV=production
ENV APP_ENV=production

RUN npm cache verify
RUN npm install

# Bundle app source
# Do not copy non-essential files
COPY . .
# Remove any unneeded files
RUN rm -rf /usr/src/app/.DS_Store
RUN rm -rf /usr/src/app/.ebextensions
RUN rm -rf /usr/src/app/.elasticbeanstalk
RUN rm -rf /usr/src/app/.git
RUN rm -rf /usr/src/app/.gitignore

# COPY ./config/production.env /usr/src/app/.env

# Link logs to stdout
RUN ln -sf /dev/stdout /usr/src/app/log/discovery-api.log

CMD [ "npm", "start" ]


FROM production as qa

ENV NODE_ENV=qa
ENV APP_ENV=qa

# COPY ./config/qa.env /usr/src/app/.env
