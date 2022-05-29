#!/bin/sh

if [[ ! -f /data/App.panel ]]
then
    echo "Missing panel file, please copy in the .panel file as App.panel"
    exit 1
fi

python3 panelparser/parser.py /data/App.panel -o soundweb-control
if [[ $? -ne 0 ]] ; then
    exit 1
fi

cd soundweb-control
echo "DATA_DIR=/data/" > .env.local
npm run build
if [[ $? -ne 0 ]] ; then
    exit 1
fi
npm run start
if [[ $? -ne 0 ]] ; then
    exit 1
fi