#!/usr/bin/env bash

# TODO: Make sure our build envs can run this! (replace xsv, and maybe unzip??)

set -e

(
    cd gtfs
    curl "https://odata.tfgm.com/opendata/downloads/TfGMgtfsnew.zip" --output tfgm.zip
    unzip -o tfgm.zip

    files=(
        'routes'
        'stop_times'
        'trips'
    )

    for file in "${files[@]}"; do
        xsv search -s 1 "^METL" -o "${file}.processed.txt" "${file}.txt"
        mv "${file}.processed.txt" "${file}.txt"
    done
)
