#!/bin/bash
#set -x
#set -e -o pipefail 

while IFS= read -r place; do
	echo $place
	IFS=":" read -r name ips <<< "$place"
	echo "Processing $name"

	for host in $ips; do
		IFS="@" read -r ip iface <<< "$host"
		echo ">$ip"
		scp -O ../hostapd_action $ip:/etc/
		ssh $ip "chmod +x /etc/hostapd_action"
		scp -O ../init.d/hostapd_action $ip:/etc/init.d/
		ssh $ip "chmod +x /etc/init.d/hostapd_action"
	 	scp -O ../config/hostapd_action.$name $ip:/etc/config/hostapd_action
		ssh $ip "sed -i 's/%IFACE%/$iface/g' /etc/config/hostapd_action"
		ssh $ip "killall -9 hostapd_cli"
		ssh $ip "/etc/init.d/hostapd_action enable"
		ssh $ip "/etc/init.d/hostapd_action start"
		scp -O testfile $ip:/tmp/
		ssh $ip "rm /tmp/testfile"
		echo " "
	done
	unset IFS
done <destinations

