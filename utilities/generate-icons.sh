#!/usr/bin/env bash

# Generate extension icon
rsvg-convert -f png -w 256 public/icons/app-icon.svg -o public/icons/app-icon.png
# Generate favicon
rsvg-convert -f png -w 32 public/icons/app-icon.svg -o public/icons/favicon.png
