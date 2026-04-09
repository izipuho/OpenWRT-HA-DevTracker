#!/bin/bash

set -euo pipefail

target=${1:-}
package=$(find ../dist -maxdepth 1 -type f -name 'ha-device-tracker_*.ipk' | sort | tail -n 1)
luci_package=$(find ../dist -maxdepth 1 -type f -name 'luci-app-ha-device-tracker_*.ipk' | sort | tail -n 1)

if [[ -z ${package:-} ]]; then
	echo "No ha-device-tracker .ipk found in ../dist" >&2
	exit 1
fi

while IFS= read -r place; do
	echo $place
	IFS=":" read -r name ips <<< "$place"
	echo "Processing $name"

	for host in $ips; do
		IFS="@" read -r ip <<< "$host"

		if [[ -n $target ]] && [[ $name != "$target" ]] && [[ $ip != "$target" ]]; then
			continue
		fi

		echo ">$ip"
		scp -O cleanup-legacy.sh "$ip:/tmp/"
		ssh -n "$ip" "sh /tmp/cleanup-legacy.sh"
		scp -O "$package" "$ip:/tmp/"
		ssh -n "$ip" "opkg install /tmp/$(basename "$package")"
		if [[ -n ${luci_package:-} ]]; then
			scp -O "$luci_package" "$ip:/tmp/"
			ssh -n "$ip" "opkg install /tmp/$(basename "$luci_package")"
		fi
		scp -O "../ha-device-tracker/config/ha-device-tracker.$name" "$ip:/etc/config/ha-device-tracker"
		ssh -n "$ip" "/etc/init.d/ha-device-tracker restart"

		echo " "
	done
	unset IFS
done <destinations
