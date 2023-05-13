FROM alpine:3.14

RUN apk add --no-cache dos2unix python3 py3-pip

WORKDIR /app

COPY ./ .

RUN dos2unix docker-entrypoint.sh

RUN pip3 install -r requirements.txt

ARG VERSION
RUN echo ${VERSION} >> /app/VERSION

# websocket port
EXPOSE 8765

# hiqnet port
EXPOSE 3804

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD python3 healthcheck.py
ENTRYPOINT ["/app/docker-entrypoint.sh"]