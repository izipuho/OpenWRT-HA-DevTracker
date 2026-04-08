#!/bin/bash

while IFS= read -r place; do
	echo $place
	IFS=":" read -r name ips <<< "$place"
	echo "Processing $name"

	if [[ $name == $1 ]] || [[ -z $1 ]]
	then
		for host in $ips; do
			IFS="@" read -r ip <<< "$host"
			echo ">$ip"
			scp -O ../ha-device-tracker $ip:/etc/ && ssh -n $ip "chmod +x /etc/ha-device-tracker"
			scp -O ../init.d/ha-device-tracker $ip:/etc/init.d/ && ssh -n $ip "chmod +x /etc/init.d/ha-device-tracker"
			scp -O ../config/ha-device-tracker.$name $ip:/etc/config/ha-device-tracker
			#ssh -n $ip "/etc/init.d/ha-device-tracker stop"
			ssh -n $ip "/etc/init.d/ha-device-tracker enable"
			ssh -n $ip "/etc/init.d/ha-device-tracker restart"

			#scp -O ../test.sh $ip:/tmp/ && 	ssh -n $ip "chmod +x /tmp/test.sh && sh /tmp/test.sh"

			echo " "
		done
	fi
	unset IFS
done <destinations
