include $(TOPDIR)/rules.mk

PKG_NAME:=ha-device-tracker
PKG_VERSION:=0.1.1
PKG_RELEASE:=2

PKG_LICENSE:=Proprietary
PKG_MAINTAINER:=izipuho

include $(INCLUDE_DIR)/package.mk

define Package/ha-device-tracker
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Home Assistant device tracker via hostapd events
  PKGARCH:=all
  DEPENDS:=+curl
endef

define Package/ha-device-tracker/description
 Push-based Wi-Fi presence tracking from OpenWrt to Home Assistant
 using hostapd_cli action hooks and UCI configuration.
endef

define Package/ha-device-tracker/conffiles
/etc/config/ha-device-tracker
endef

define Package/ha-device-tracker/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/ha-device-tracker enable >/dev/null 2>&1 || true
exit 0
endef

define Package/ha-device-tracker/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/etc/init.d/ha-device-tracker stop >/dev/null 2>&1 || true
/etc/init.d/ha-device-tracker disable >/dev/null 2>&1 || true
exit 0
endef

define Build/Compile
endef

define Package/ha-device-tracker/install
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/etc/ha-device-tracker $(1)/etc/ha-device-tracker
	$(INSTALL_BIN) $(CURDIR)/files/etc/init.d/ha-device-tracker $(1)/etc/init.d/ha-device-tracker
	$(INSTALL_CONF) $(CURDIR)/files/etc/config/ha-device-tracker $(1)/etc/config/ha-device-tracker
endef

$(eval $(call BuildPackage,ha-device-tracker))
