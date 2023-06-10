#!/usr/bin/env bash

set -ex

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
        # Reduce down to Metrolink-related entries
        xsv search -s 1 "^METL" -o "${file}.processed.txt" "${file}.txt"
        mv "${file}.processed.txt" "${file}.txt"
    done
)
