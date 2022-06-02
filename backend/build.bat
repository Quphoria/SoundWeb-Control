REM Change directory to script directory
cd /D "%~dp0"

set tag="quphoria/hiqnet-websocket-proxy:v1.0.1"

@REM docker build --tag %tag% .
docker buildx build --platform=linux/amd64,linux/arm64 --tag %tag% .