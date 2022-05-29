REM Change directory to script directory
cd /D "%~dp0"

set tag="quphoria/soundweb-control:v1.0.0"

docker build --tag %tag% .