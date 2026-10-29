#!/bin/sh
set -eu
# A newly mounted persistent disk can be root-owned. Only this app's data folder needs write access.
mkdir -p /var/data/accessfix/runs
chown node:node /var/data/accessfix /var/data/accessfix/runs
exec gosu node "$@"
