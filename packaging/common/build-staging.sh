#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)

. "$SCRIPT_DIR/package.conf"

STAGING_ROOT="$REPO_ROOT/build/staging/$NAME"
PAYLOAD_ROOT="$STAGING_ROOT/payload"
CONTROL_ROOT="$STAGING_ROOT/control"
CONFFILES_PATH="$CONTROL_ROOT/conffiles"
MANIFEST_PATH="$SCRIPT_DIR/files.manifest"

rm -rf "$STAGING_ROOT"
mkdir -p "$PAYLOAD_ROOT" "$CONTROL_ROOT"
: >"$CONFFILES_PATH"

while IFS= read -r entry || [ -n "$entry" ]; do
	case "$entry" in
		''|'#'*)
			continue
		;;
		conffile:*)
			printf '%s\n' "${entry#conffile:}" >>"$CONFFILES_PATH"
			continue
		;;
	esac

	src=${entry%%:*}
	dst=${entry#*:}

	if [ -z "$src" ] || [ -z "$dst" ] || [ "$src" = "$dst" ]; then
		echo "Invalid manifest entry: $entry" >&2
		exit 1
	fi

	src_path="$REPO_ROOT/$src"
	dst_path="$PAYLOAD_ROOT$dst"
	dst_dir=$(dirname "$dst_path")

	if [ ! -f "$src_path" ]; then
		echo "Missing source file: $src" >&2
		exit 1
	fi

	mkdir -p "$dst_dir"
	install -m 0644 "$src_path" "$dst_path"

	if [ -x "$src_path" ]; then
		chmod 0755 "$dst_path"
	fi
done <"$MANIFEST_PATH"
