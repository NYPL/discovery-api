FROM node:20-bullseye as production

RUN apt-get update
RUN apt-get upgrade -y

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json ./

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

ENV LOG_STYLE=json

CMD [ "npm", "start" ]
