#!/usr/bin/env bash

# Generate extension icon
rsvg-convert -f png -w 256 public/icons/extension-icon.svg -o public/icons/extension-icon.png
# Generate favicon
rsvg-convert -f png -w 32 public/icons/extension-icon.svg -o public/icons/favicon.png
