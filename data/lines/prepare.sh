#!/usr/bin/env bash
#
# Download TfGM's GTFS feed into ./gtfs and normalise it for the rest of the
# pipeline (see normalise-gtfs.mjs).

set -ex

(
    cd gtfs
    curl --fail --location "https://odata.tfgm.com/opendata/downloads/TfGMgtfsnew.zip" --output tfgm.zip
    unzip -o tfgm.zip
)

node normalise-gtfs.mjs
