#!/bin/bash
#set -x
#set -e -o pipefail 

while IFS= read -r place; do
	echo $place
	IFS=":" read -r name ips <<< "$place"
	echo "Processing $name"

	if [ $name == $1 ] || [ -z $1 ]
	then
		for host in $ips; do
			IFS="@" read -r ip iface <<< "$host"
			echo ">$ip"
			scp -O ../hostapd_action $ip:/etc/
			ssh $ip "chmod +x /etc/hostapd_action" < /dev/null
			scp -O ../init.d/hostapd_action $ip:/etc/init.d/
			ssh $ip "chmod +x /etc/init.d/hostapd_action" < /dev/null
			scp -O ../config/hostapd_action.$name $ip:/etc/config/hostapd_action
			ssh $ip "uci add_list hostapd_action.network.IFACE=$iface" < /dev/null
			ssh $ip "uci commit hostapd_action" < /dev/null
			ssh $ip "killall -9 hostapd_cli" < /dev/null
			ssh $ip "/etc/init.d/hostapd_action enable" < /dev/null
			ssh $ip "/etc/init.d/hostapd_action start" < /dev/null

			echo " "
		done
	fi
	unset IFS
done <destinations

