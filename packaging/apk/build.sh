#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
COMMON_DIR="$REPO_ROOT/packaging/common"

. "$COMMON_DIR/package.conf"

PACKAGE_VERSION="$VERSION-r$RELEASE"
STAGING_ROOT="$REPO_ROOT/build/staging/$NAME"
PAYLOAD_ROOT="$STAGING_ROOT/payload"
APK_ROOT="$REPO_ROOT/build/apk/$NAME"
CONTROL_ROOT="$APK_ROOT/control"
DIST_DIR="$REPO_ROOT/dist"
DATA_TAR="$APK_ROOT/data.tar.gz"
CONTROL_TAR="$APK_ROOT/control.tar.gz"
PKGINFO_PATH="$CONTROL_ROOT/.PKGINFO"
OUTPUT_APK="$DIST_DIR/${NAME}-${PACKAGE_VERSION}.apk"

sha256_file() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$1" | awk '{print $1}'
	elif command -v shasum >/dev/null 2>&1; then
		shasum -a 256 "$1" | awk '{print $1}'
	else
		echo "No SHA-256 tool found (need sha256sum or shasum)" >&2
		exit 1
	fi
}

installed_size() {
	find "$1" -type f -exec wc -c {} + | awk 'END {print $1 + 0}'
}

sh "$COMMON_DIR/build-staging.sh"

rm -rf "$APK_ROOT"
mkdir -p "$CONTROL_ROOT" "$DIST_DIR"

tar -C "$PAYLOAD_ROOT" -czf "$DATA_TAR" .

DATAHASH=$(sha256_file "$DATA_TAR")
SIZE=$(installed_size "$PAYLOAD_ROOT")
BUILDDATE=$(date +%s)

cat >"$PKGINFO_PATH" <<EOF
pkgname = $NAME
pkgver = $PACKAGE_VERSION
pkgdesc = $TITLE
size = $SIZE
arch = $ARCH
origin = $NAME
maintainer = $MAINTAINER
license = $LICENSE
depend = $DEPENDS
builddate = $BUILDDATE
datahash = $DATAHASH
EOF

install -m 0755 "$COMMON_DIR/postinst" "$CONTROL_ROOT/.post-install"
install -m 0755 "$COMMON_DIR/prerm" "$CONTROL_ROOT/.pre-deinstall"

tar -C "$CONTROL_ROOT" -czf "$CONTROL_TAR" .

rm -f "$OUTPUT_APK"
cat "$CONTROL_TAR" "$DATA_TAR" >"$OUTPUT_APK"

printf '%s\n' "$OUTPUT_APK"
