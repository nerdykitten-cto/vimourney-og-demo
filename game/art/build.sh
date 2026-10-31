#!/usr/bin/env bash
# Rebuild all sprites: Aseprite scripts draw the .aseprite sources, then Aseprite exports sheets to public/sprites.
set -euo pipefail
cd "$(dirname "$0")"
ASE="${ASEPRITE:-$HOME/.steam/debian-installation/steamapps/common/Aseprite/aseprite}"
OUT="$(pwd)/../public/sprites"
mkdir -p src "$OUT"
"$ASE" -b --script-param out=src --script build.lua
cd src
sheet() { local out=$1; shift; "$ASE" -b "$@" --sheet "$OUT/$out.png" --sheet-type horizontal; }
sheet actors player.aseprite sentry.aseprite patrol.aseprite stalker.aseprite crawler.aseprite blinker.aseprite lesson.aseprite sniper.aseprite hopper.aseprite
sheet tiles floor0.aseprite floor1.aseprite floor2.aseprite wall.aseprite doorClosed.aseprite doorOpen.aseprite
sheet warden warden.aseprite
sheet seeker seeker.aseprite
# Favicon: the player on the game's background, 4x so it survives browser tab scaling.
"$ASE" -b --frame-range 0,0 player.aseprite --scale 4 --save-as "$OUT/../favicon.png"
