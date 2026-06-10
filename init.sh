#!/usr/bin/env bash
set -euo pipefail

echo "Firebelly workspace: $(pwd)"

echo
echo "Installing client dependencies"
(cd firebelly-client && yarn install)

echo
echo "Installing server dependencies"
(cd firebelly-server && yarn install)

echo
echo "Verifying client"
(cd firebelly-client && yarn lint && yarn build)

echo
echo "Verifying server"
(cd firebelly-server && yarn test)

echo
echo "Start commands:"
echo "  cd firebelly-server && yarn dev"
echo "  cd firebelly-client && yarn dev"
