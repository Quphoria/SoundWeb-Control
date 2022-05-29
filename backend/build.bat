REM Change directory to script directory
cd /D "%~dp0"

set tag="hiqnet-websocket-proxy"

docker build --tag %tag% .