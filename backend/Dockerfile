FROM alpine:3.14

RUN apk add --no-cache dos2unix python3 py3-pip

WORKDIR /app

COPY ./ .

RUN pip3 install -r requirements.txt

ARG VERSION
ENV VERSION=${VERSION}

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD python3 healthcheck.py
ENTRYPOINT ["python3", "websocket_bridge_multi.py"]