#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
COMMON_DIR="$REPO_ROOT/packaging/common"

. "$COMMON_DIR/package.conf"

PACKAGE_VERSION="$VERSION-$RELEASE"
STAGING_ROOT="$REPO_ROOT/build/staging/$NAME"
PAYLOAD_ROOT="$STAGING_ROOT/payload"
CONTROL_ROOT="$STAGING_ROOT/control"
IPK_ROOT="$REPO_ROOT/build/ipk/$NAME"
DIST_DIR="$REPO_ROOT/dist"
CONTROL_FILE="$CONTROL_ROOT/control"
DATA_TAR="$IPK_ROOT/data.tar.gz"
CONTROL_TAR="$IPK_ROOT/control.tar.gz"
DEBIAN_BINARY="$IPK_ROOT/debian-binary"
OUTPUT_IPK="$DIST_DIR/${NAME}_${PACKAGE_VERSION}_${ARCH}.ipk"

sh "$COMMON_DIR/build-staging.sh"

rm -rf "$IPK_ROOT"
mkdir -p "$IPK_ROOT" "$DIST_DIR"

install -m 0755 "$COMMON_DIR/postinst" "$CONTROL_ROOT/postinst"
install -m 0755 "$COMMON_DIR/prerm" "$CONTROL_ROOT/prerm"

cat >"$CONTROL_FILE" <<EOF
Package: $NAME
Version: $PACKAGE_VERSION
Depends: $DEPENDS
Section: $SECTION
Category: $CATEGORY
Architecture: $ARCH
Maintainer: $MAINTAINER
License: $LICENSE
Description: $DESCRIPTION
EOF

printf '2.0\n' >"$DEBIAN_BINARY"

tar -C "$PAYLOAD_ROOT" -czf "$DATA_TAR" .
tar -C "$CONTROL_ROOT" -czf "$CONTROL_TAR" .

rm -f "$OUTPUT_IPK"
ar -r "$OUTPUT_IPK" "$DEBIAN_BINARY" "$DATA_TAR" "$CONTROL_TAR" >/dev/null 2>&1

printf '%s\n' "$OUTPUT_IPK"
