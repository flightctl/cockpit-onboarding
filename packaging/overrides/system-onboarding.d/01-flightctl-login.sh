#!/bin/bash

set -e

# Validate pre-requisites
if ! command -v flightctl >/dev/null 2>&1; then
    echo "Error: flightctl CLI is not found."
    exit 1
fi

AUTH_ARGS=

case ${ENROLLMENT_AUTH_METHOD} in
    "token")
        if [ -z "${ENROLLMENT_TOKEN}" ]; then
            echo "Error: {$ENROLLMENT_TOKEN} is not set for token-based authentication."
            exit 1
        fi
        AUTH_ARGS=(--token "${ENROLLMENT_TOKEN}")
        ;;
    "username-password")
        if [ -z "${ENROLLMENT_USERNAME}" ] || [ -z "${ENROLLMENT_PASSWORD}" ]; then
            echo "Error: ENROLLMENT_USERNAME or ENROLLMENT_PASSWORD is not set for password-based authentication."
            exit 1
        fi
        AUTH_ARGS=(--username "${ENROLLMENT_USERNAME}" --password "${ENROLLMENT_PASSWORD}")
        ;;
    *)
        echo "Error: Unsupported or unset ENROLLMENT_AUTH_METHOD. Supported methods are 'token' and 'username-and-password'."
        exit 1
        ;;
esac

if [ "${ENROLLMENT_SKIP_TLS_VERIFICATION}" == "true" ]; then
    AUTH_ARGS+=("--insecure-skip-tls-verify")
fi

# Log into Flight Control
echo "Logging into Flight Control service ${ENROLLMENT_URL}..."

flightctl login "${AUTH_ARGS[@]}" "${ENROLLMENT_URL}"
