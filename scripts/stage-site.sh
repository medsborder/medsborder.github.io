#!/bin/sh
# Copies exactly the publishable files into _site/. Used by the deploy job,
# the audit job and `just audit`, so what is audited is what is published.
set -eu
rm -rf _site
mkdir _site
cp -r index.html 404.html robots.txt sitemap.xml humans.txt site.webmanifest favicon.ico en uk assets data _site/
