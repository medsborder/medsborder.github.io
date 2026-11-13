#!/bin/sh
# Builds exactly the publishable files into _site/ (bundled JS, one data file,
# rewritten HTML). Used by the deploy job, the audit job and `just audit`, so
# what is audited is what is published. Needs Docker.
set -eu
rm -rf _site
mkdir _site
cp -r index.html 404.html robots.txt sitemap.xml humans.txt site.webmanifest favicon.ico en uk assets data _site/
docker build -q -t medsborder-build build >/dev/null
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/work -w /work medsborder-build _site
