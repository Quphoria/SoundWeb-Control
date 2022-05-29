REM Change directory to script directory
cd /D "%~dp0"

set tag="quphoria/hiqnet-websocket-proxy:v1.0.0"

docker build --tag %tag% .