# MedsBorder tasks. Tests run in Docker.

default:
    @just --list

# Serve the static site locally on http://localhost:8080
serve:
    python3 -m http.server 8080

# Run unit tests in Docker
test:
    docker build -t medsborder-test .
    docker run --rm medsborder-test

# Validate data files against the schema rules
validate-data:
    docker build -t medsborder-test .
    docker run --rm medsborder-test node scripts/validate-data.js

# Render icons and OG images from design/*.svg (in Docker)
assets:
    docker run --rm -e HOST_UID=$(id -u) -e HOST_GID=$(id -g) -v "$PWD":/work -w /work alpine:3.20 sh scripts/make-assets.sh

# Regenerate sitemap.xml with today's date (in Docker)
sitemap:
    docker run --rm -v "$PWD":/work -w /work node:22-alpine node scripts/sitemap.mjs $(date +%F) > sitemap.xml

# Remove generated files
clean:
    rm -rf _site
