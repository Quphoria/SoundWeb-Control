REM Change directory to script directory
cd /D "%~dp0"

set tag="soundweb-control"

docker build --tag %tag% .