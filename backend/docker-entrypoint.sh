#!/bin/sh

while :
do
    python3 websocket_bridge_multi.py
    if [[ $? -ne 0 ]] ; then
        exit 1
    fi

    echo "Backend process stopped, relaunching..."
done