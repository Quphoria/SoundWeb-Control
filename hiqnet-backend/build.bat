REM Change directory to script directory
cd /D "%~dp0"

SET BASETAG=quphoria/hiqnet-websocket-proxy
SET VERSION=v1.0.10
SET latest=1

SET tag="%BASETAG%:%VERSION%"
SET latesttag=
if defined latest SET latesttag=--tag "%BASETAG%"

@REM docker build --tag %tag% .
docker buildx create --name soundwebbuilder --use
docker buildx build --platform=linux/amd64,linux/arm64,linux/arm --push --build-arg VERSION=%VERSION% --tag %tag% %latesttag% .
docker buildx rm soundwebbuilder