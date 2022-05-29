REM Change directory to script directory
cd /D "%~dp0"

set tag="quphoria/hiqnet-websocket-proxy"

docker build --tag %tag% .