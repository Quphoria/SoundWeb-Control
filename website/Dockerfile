FROM alpine:3.14
ARG TARGETPLATFORM

RUN apk add --no-cache dos2unix python3 py3-pip nodejs npm curl

# we need build tools on arm for building node modules
RUN if [[ $TARGETPLATFORM == linux/arm* ]]; then \
    apk add --no-cache make gcc g++; \
  fi

WORKDIR /app

COPY ./ .

# fix issue loading nextjs swc on arm
# https://github.com/vercel/next.js/discussions/30468
# disable swc on arm (32-bit)
RUN if [[ $TARGETPLATFORM == linux/arm* && $TARGETPLATFORM != linux/arm64* ]]; then \
    printf '{\n  "presets": ["next/babel"]\n}' > /app/soundweb-control/.babelrc; \
    sed -i 's/swcMinify: true/swcMinify: false/g' /app/soundweb-control/next.config.js; \
  fi

# this gets run in the entrypoint script to reduce image size
# WORKDIR /app/soundweb-control
# RUN npm install --force
# WORKDIR /app

RUN dos2unix docker-entrypoint.sh
RUN mkdir /data

ARG VERSION
ENV VERSION=${VERSION}

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -s --fail http://localhost:3000 || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]