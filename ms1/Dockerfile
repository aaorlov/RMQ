FROM node:10-alpine

WORKDIR /opt/app

ENV PORT 80

COPY package.json package-lock.json ./
RUN apk add --update git && \
    npm i --production

COPY . .

ENTRYPOINT [ "./docker-entrypoint.sh" ]

CMD [ "start" ]
