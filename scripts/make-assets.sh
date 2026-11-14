#!/bin/sh
# Renders icons and Open Graph images from design/*.svg. Runs inside Docker
# (see `just assets`); the generated files are committed.
set -eu
apk add --no-cache rsvg-convert imagemagick ttf-dejavu font-inter >/dev/null

mkdir -p assets/icons assets/og
cp design/icon.svg assets/icons/icon.svg
rsvg-convert -w 192 -h 192 design/icon.svg -o assets/icons/icon-192.png
rsvg-convert -w 512 -h 512 design/icon.svg -o assets/icons/icon-512.png
rsvg-convert -w 512 -h 512 design/icon-maskable.svg -o assets/icons/icon-maskable-512.png
rsvg-convert -w 180 -h 180 design/icon-maskable.svg -o assets/icons/apple-touch-icon.png
rsvg-convert -w 256 -h 256 design/icon.svg -o /tmp/icon-256.png
convert /tmp/icon-256.png -define icon:auto-resize=48,32,16 favicon.ico
for lang in en uk; do
  rsvg-convert -w 1200 -h 630 "design/og-$lang.svg" -o "assets/og/og-$lang.png"
done
chown -R "${HOST_UID:-0}:${HOST_GID:-0}" assets/icons assets/og favicon.ico
ls -la assets/icons assets/og favicon.ico
