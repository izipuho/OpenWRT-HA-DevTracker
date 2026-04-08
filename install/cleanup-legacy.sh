#!/bin/sh

set -eu

LEGACY_NAME=hostapd_action
APP_NAME=ha-device-tracker
LEGACY_ACTION="/etc/$LEGACY_NAME"
LEGACY_INIT="/etc/init.d/$LEGACY_NAME"
LEGACY_CONFIG="/etc/config/$LEGACY_NAME"
APP_INIT="/etc/init.d/$APP_NAME"

if [ -x "$LEGACY_INIT" ]; then
        "$LEGACY_INIT" stop || true
        "$LEGACY_INIT" disable || true
fi

rm -f "$LEGACY_ACTION"
rm -f "$LEGACY_INIT"
rm -f "$LEGACY_CONFIG"

if [ -x "$APP_INIT" ]; then
        "$APP_INIT" restart || true
fi
