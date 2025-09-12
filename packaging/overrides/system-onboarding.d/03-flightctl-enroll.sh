#!/bin/bash

set -e

# Wait for enrollment banner to be available and print it
while [ ! -f /etc/issue.d/flightctl-banner.issue ]; do
    sleep 1
done

cat /etc/issue.d/flightctl-banner.issue
