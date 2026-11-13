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

# Copy the publishable files into _site/
stage:
    ./scripts/stage-site.sh

# Accessibility (axe) and Lighthouse audit of the staged site, in Docker. Reports go to audit/out
audit: stage
    docker build -t medsborder-audit audit
    mkdir -p audit/out
    docker run --rm --shm-size=1g --user $(id -u):$(id -g) -v "$PWD/_site":/site:ro -v "$PWD/audit/out":/audit/out medsborder-audit

# Remove generated files
clean:
    rm -rf _site
