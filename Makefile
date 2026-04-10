TARGET ?= ath79
SUBTARGET ?= generic
RELEASES ?=

PKG_NAME := ha-device-tracker
FEED_NAME := local
LEAVE_BUILD ?= no

.PHONY: build build-one

build:
	@set -eu; \
	releases="$(RELEASES)"; \
	if [ -z "$$releases" ]; then \
		releases=$$(curl -fsSL 'https://sysupgrade.openwrt.org/api/v1/latest' | \
			grep -Eo '"[0-9]+\.[0-9]+\.[0-9]+"' | tr -d '"' | sort -V); \
	fi; \
	if [ -z "$$releases" ]; then \
		echo "Could not determine latest OpenWrt releases from sysupgrade API" >&2; \
		exit 1; \
	fi; \
	for release in $$releases; do \
		echo "==> Building $(PKG_NAME) for OpenWrt $$release"; \
		$(MAKE) build-one RELEASE="$$release" TARGET="$(TARGET)" SUBTARGET="$(SUBTARGET)" LEAVE_BUILD="$(LEAVE_BUILD)" SDK_FILE="$(SDK_FILE)"; \
	done

build-one:
	@set -eu; \
	if [ -z "$(RELEASE)" ] || [ -z "$(TARGET)" ] || [ -z "$(SUBTARGET)" ]; then \
		echo "Set RELEASE, TARGET and SUBTARGET before running build." >&2; \
		echo "Example: make build-one RELEASE=24.10.5 TARGET=ath79 SUBTARGET=generic" >&2; \
		exit 1; \
	fi; \
	build_dir=$$(mktemp -d /tmp/ha-device-tracker-sdk-XXXXX); \
	cleanup() { \
		if [ "$(LEAVE_BUILD)" != "yes" ]; then \
			rm -rf "$$build_dir"; \
		else \
			echo "Build directory kept at $$build_dir"; \
		fi; \
	}; \
	trap cleanup EXIT INT TERM; \
	dist_dir="$(CURDIR)/dist"; \
	base_url="https://downloads.openwrt.org/releases/$(RELEASE)/targets/$(TARGET)/$(SUBTARGET)"; \
	sdk_file="$(SDK_FILE)"; \
	if [ -z "$$sdk_file" ]; then \
		sdk_file=$$(curl -fsSL "$$base_url/sha256sums" | grep -o 'openwrt-sdk-$(RELEASE)-$(TARGET)-$(SUBTARGET)_[^ ]*\.tar\.zst' | head -n 1); \
	fi; \
	if [ -z "$$sdk_file" ]; then \
		echo "Could not determine SDK archive from $$base_url/sha256sums" >&2; \
		exit 1; \
	fi; \
	mkdir -p "$$dist_dir"; \
	cd "$$build_dir"; \
	curl -fL -O "$$base_url/$$sdk_file"; \
	tar --zstd -xf "$$sdk_file"; \
	sdk_root=$$(find "$$build_dir" -maxdepth 1 -type d -name 'openwrt-sdk-*' | head -n 1); \
	if [ -z "$$sdk_root" ]; then \
		echo "SDK extraction failed in $$build_dir" >&2; \
		exit 1; \
	fi; \
	feeds_conf="$$sdk_root/feeds.conf"; \
	feeds_conf_default="$$sdk_root/feeds.conf.default"; \
	: > "$$feeds_conf"; \
	if [ -f "$$feeds_conf_default" ]; then \
		grep -E '^[[:space:]]*src-git[[:space:]]+packages[[:space:]]' "$$feeds_conf_default" >> "$$feeds_conf" || true; \
		grep -E '^[[:space:]]*src-git[[:space:]]+luci[[:space:]]' "$$feeds_conf_default" >> "$$feeds_conf" || true; \
	fi; \
	grep -q '^src-link $(FEED_NAME) $(CURDIR)$$' "$$feeds_conf" || echo "src-link $(FEED_NAME) $(CURDIR)" >> "$$feeds_conf"; \
	cd "$$sdk_root"; \
	./scripts/feeds update packages; \
	./scripts/feeds update luci; \
	./scripts/feeds update $(FEED_NAME); \
	./scripts/feeds install -p $(FEED_NAME) $(PKG_NAME); \
	./scripts/feeds install -p $(FEED_NAME) luci-app-$(PKG_NAME); \
	grep -q '^CONFIG_PACKAGE_$(PKG_NAME)=m$$' .config 2>/dev/null || echo 'CONFIG_PACKAGE_$(PKG_NAME)=m' >> .config; \
	grep -q '^CONFIG_PACKAGE_luci-app-$(PKG_NAME)=m$$' .config 2>/dev/null || echo 'CONFIG_PACKAGE_luci-app-$(PKG_NAME)=m' >> .config; \
	$(MAKE) defconfig; \
	$(MAKE) package/$(PKG_NAME)/compile V=s; \
	case "$(RELEASE)" in \
		24.*) pkg_ext=ipk ;; \
		25.12*|25.1[2-9]*|2[6-9].*|[3-9][0-9].*) pkg_ext=apk ;; \
		*) pkg_ext=ipk ;; \
	esac; \
	pkg_paths=$$(find "$$sdk_root/bin" \( -name '$(PKG_NAME)*.'"$$pkg_ext" -o -name 'luci-app-$(PKG_NAME)*.'"$$pkg_ext" \) | sort); \
	if [ -z "$$pkg_paths" ]; then \
		echo "Built packages (*.$$pkg_ext) not found under $$sdk_root/bin" >&2; \
		exit 1; \
	fi; \
	for pkg_path in $$pkg_paths; do \
		cp "$$pkg_path" "$$dist_dir/"; \
		echo "Copied $$pkg_path to $$dist_dir/"; \
	done
