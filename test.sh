#!/bin/sh
. /lib/functions.sh
config_load hostapd_action

config_get IFACES network iface
init_device() {
	config_get mac $1 mac
	uci set hostapd_action.$1.iface=none
	for iface in $IFACES
	do
		if [[ `hostapd_cli -i $iface sta $mac | head -n 1` != FAIL  ]]
		then
			uci set hostapd_action.$1.iface=$iface
		else
			/etc/hostapd_action $iface AP-STA-DISCONNECTED $mac
		fi
	done
	uci commit hostapd_action
}

handle_device() {
	config_get iface $1 iface
	config_get mac $1 mac
	if [[ $iface != "none" ]]
	then
		echo "$1 is on $iface" 
		/etc/hostapd_action $iface AP-STA-CONNECTED $mac
	else
		echo "$1 is offline"
	fi
}

config_foreach init_device device
config_foreach handle_device device
