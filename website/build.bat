REM Change directory to script directory
cd /D "%~dp0"

SET BASETAG=quphoria/soundweb-control
SET VERSION=v1.1.5
SET latest=1
@REM SET development=1

SET tag="%BASETAG%:%VERSION%"
SET latesttag=
if defined latest SET latesttag=--tag "%BASETAG%"
if defined development SET tag="%BASETAG%:dev"
if defined development SET VERSION=dev
if defined development SET latesttag=

@REM docker build --tag %tag% .
docker buildx create --name soundwebbuilder --use
docker buildx build --platform=linux/amd64,linux/arm64,linux/arm --push --build-arg VERSION=%VERSION% --tag %tag% %latesttag% .
docker buildx rm soundwebbuilder