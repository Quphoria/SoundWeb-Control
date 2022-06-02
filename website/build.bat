REM Change directory to script directory
cd /D "%~dp0"

SET latest=1

SET tag="quphoria/soundweb-control:v1.0.1"
SET latesttag=
if defined latest SET latesttag=--tag "quphoria/soundweb-control"

@REM docker build --tag %tag% .
docker buildx create --name soundwebbuilder --use
docker buildx build --platform=linux/amd64,linux/arm64,linux/arm --push --tag %tag% %latesttag% .
docker buildx rm soundwebbuilder