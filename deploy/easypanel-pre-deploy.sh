#!/usr/bin/env bash
# EasyPanel → backend → Deployments → Deploy Script (paste this entire file)
# Forces CACHEBUST so the next deploy runs a REAL Docker build (not a 10s restart)
export CACHEBUST="$(date +%s)"
export EASYPANEL_DEPLOY="rebuild"
echo "CACHEBUST=$CACHEBUST — forced rebuild at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Expected deploy duration: 2-5 minutes (npm ci + runtime bundle download)"
