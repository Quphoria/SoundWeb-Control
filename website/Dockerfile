FROM alpine:3.14
ARG TARGETPLATFORM

RUN apk add --no-cache dos2unix python3 py3-pip nodejs npm curl

# we need build tools on arm for building node modules
RUN if [[ $TARGETPLATFORM == linux/arm* ]]; then \
    apk add --no-cache make gcc g++; \
  fi

WORKDIR /app

COPY ./ .

WORKDIR /app/soundweb-control

RUN npm install --force

WORKDIR /app

RUN dos2unix docker-entrypoint.sh
RUN mkdir /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:3000 || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]