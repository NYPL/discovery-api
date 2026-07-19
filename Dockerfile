FROM node:25-bullseye AS production

RUN apt-get update
RUN apt-get upgrade -y

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package-lock.json ./
COPY package.json ./
RUN npm cache verify
RUN npm install

# Add app source
COPY . .

# Remove any unneeded files
RUN rm -rf /usr/src/app/.DS_Store
RUN rm -rf /usr/src/app/.ebextensions
RUN rm -rf /usr/src/app/.elasticbeanstalk
RUN rm -rf /usr/src/app/.git
RUN rm -rf /usr/src/app/.gitignore

ENV LOG_STYLE=json

CMD [ "npm", "start" ]
