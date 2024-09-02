#!/bin/bash
#set -x
#set -e -o pipefail 

while IFS= read -r place; do
	echo $place
	IFS=":" read -r name ips <<< "$place"
	echo "Processing $name"

	if [[ $name == $1 ]] || [[ -z $1 ]]
	then
		for host in $ips; do
			IFS="@" read -r ip <<< "$host"
			echo ">$ip"
			scp -O ../hostapd_action $ip:/etc/
			ssh -n $ip "chmod +x /etc/hostapd_action"
			scp -O ../init.d/hostapd_action $ip:/etc/init.d/
			ssh -n $ip "chmod +x /etc/init.d/hostapd_action"
			scp -O ../config/hostapd_action.$name $ip:/etc/config/hostapd_action
			#ssh -n $ip "/etc/init.d/hostapd_action stop"
			ssh -n $ip "killall -9 hostapd_cli"
			ssh -n $ip "/etc/init.d/hostapd_action enable"
			ssh -n $ip "/etc/init.d/hostapd_action start"

			echo " "
		done
	fi
	unset IFS
done <destinations

