#!/usr/bin/env bash
# EasyPanel → backend → Settings → Deploy Script (paste this)
# Forces CACHEBUST so next deploy rebuilds (not 2-second restart)
export CACHEBUST="$(date +%s)"
echo "CACHEBUST=$CACHEBUST — rebuild forced at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
