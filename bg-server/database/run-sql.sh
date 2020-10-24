#!/bin/bash

set -e
set -u

if [ $# != 1 ]; then
    echo "please enter a path to a sql script"
    exit 1
fi

# export DBHOST=$1
# export TSUFF=$2
export SCRIPT_PATH=$1

sudo -u bg-database psql \
    -X
    --echo-all \
    --set AUTOCOMMIT=off \
    -f $SCRIPT_PATH \
    --set ON_ERROR_STOP=on \
    bg-database

export EXIT_CODE=$?

if [ $EXIT_CODE != 0 ]; then
    echo "psql failed while trying to run this sql script" 1>&2
    exit $EXIT_CODE
fi

echo "sql script successful"
exit 0