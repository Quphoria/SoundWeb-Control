REM Change directory to script directory
cd /D "%~dp0"

set tag="quphoria/soundweb-control"

docker build --tag %tag% .