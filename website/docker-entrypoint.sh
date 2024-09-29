#!/bin/sh

export VERSION=`cat VERSION || echo Unknown`

# expose version env variable to nextjs
export NEXT_PUBLIC_VERSION=$VERSION

# install npm modules on launch to reduce image size
# shouldn't take that long if already installed
# force as some modules don't offically support the latest version of react
cd soundweb-control
if [[ ! -f package-lock.json ]] ; then
    echo "Installing node modules..."
fi
# install next@canary if we are using babel to prevent swc errors from breaking the build
if [[ -f .babelrc ]] ; then
    npm install next@canary --force
fi
npm install --force
cd ..


while :
do
    if [[ ! -f /data/App.panel ]] ; then
        echo "Missing panel file, please copy in the .panel file as App.panel"
        # don't exit here as panelparser should generate error page
        # exit 1
    fi

    EXTRA_PARSER_ARGS=""
    if [[ -f /data/SHOW_PANEL_ERRORS ]] ; then
        echo "/data/SHOW_PANEL_ERRORS present, controls with errors will be generated instead throwing of an error page"
        EXTRA_PARSER_ARGS="--show_errors"
    fi

    python3 panelparser/parser.py /data/App.panel -o soundweb-control $EXTRA_PARSER_ARGS
    if [[ $? -ne 0 ]] ; then
        exit 1
    fi

    sleep 10s

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

    echo "Server process stopped, relaunching..."
done