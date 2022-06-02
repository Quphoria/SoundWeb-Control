REM Change directory to script directory
cd /D "%~dp0"

set tag="quphoria/soundweb-control:v1.0.1"

@REM docker build --tag %tag% .
docker buildx create --name soundwebbuilder --use
docker buildx build --platform=linux/amd64,linux/arm64 --tag %tag% .
docker buildx rm soundwebbuilder