RELEASE ?= 24.10.3
TARGET ?= ath79
SUBTARGET ?= generic

PKG_NAME := ha-device-tracker
FEED_NAME := local
LEAVE_BUILD ?= no

.PHONY: build

build:
	@set -eu; \
	if [ -z "$(RELEASE)" ] || [ -z "$(TARGET)" ] || [ -z "$(SUBTARGET)" ]; then \
		echo "Set RELEASE, TARGET and SUBTARGET before running build." >&2; \
		echo "Example: make build RELEASE=24.10.3 TARGET=ath79 SUBTARGET=generic" >&2; \
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
	grep -q '^src-link $(FEED_NAME) $(CURDIR)$$' "$$feeds_conf" || echo "src-link $(FEED_NAME) $(CURDIR)" >> "$$feeds_conf"; \
	cd "$$sdk_root"; \
	./scripts/feeds update -a; \
	./scripts/feeds install -a; \
	grep -q '^CONFIG_PACKAGE_$(PKG_NAME)=m$$' .config 2>/dev/null || echo 'CONFIG_PACKAGE_$(PKG_NAME)=m' >> .config; \
	$(MAKE) defconfig; \
	$(MAKE) package/$(PKG_NAME)/compile V=s; \
	ipk_path=$$(find "$$sdk_root/bin" -name '$(PKG_NAME)*.ipk' | head -n 1); \
	if [ -z "$$ipk_path" ]; then \
		echo "Built package not found under $$sdk_root/bin" >&2; \
		exit 1; \
	fi; \
	cp "$$ipk_path" "$$dist_dir/"; \
	echo "Copied $$ipk_path to $$dist_dir/"
