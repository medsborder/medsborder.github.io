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

# Remove generated files
clean:
    rm -rf _site
