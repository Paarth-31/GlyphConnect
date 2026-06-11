#!/bin/bash
# Test forgot-password endpoint on the live server
curl -s -X POST https://rda-signaling.duckdns.org/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"aayushinba07@gmail.com"}' | python3 -m json.tool
