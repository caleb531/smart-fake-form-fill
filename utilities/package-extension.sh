#!/usr/bin/env bash

dist_name=smart-fake-form-fill
pnpm build || exit 1
cp -r dist/ "$dist_name" && \
  zip -r "$dist_name".zip "$dist_name" || exit 1
rm -rf "$dist_name" || exit 1
