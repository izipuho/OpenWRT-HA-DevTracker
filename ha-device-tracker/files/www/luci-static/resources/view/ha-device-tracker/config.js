'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require fs';
'require ui';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ha-device-tracker'),
			this.loadServiceStatus()
		]);
	},

	loadServiceStatus: function() {
		return callServiceList('ha-device-tracker').catch(function() {
			return null;
		});
	},

	getServiceRunning: function(serviceStatus) {
		var instances, instanceName;

		if (!serviceStatus || !serviceStatus['ha-device-tracker'])
			return false;

		instances = serviceStatus['ha-device-tracker'].instances || {};

		for (instanceName in instances)
			if (instances[instanceName].running)
				return true;

		return false;
	},

	runAction: function(action) {
		return fs.exec('/etc/init.d/ha-device-tracker', [ action ]).then(function(res) {
			if (res.code !== 0)
				throw new Error(res.stderr || _('Command failed'));

			ui.addNotification(null, E('p', {}, _('Action completed successfully.')));
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Action failed: %s').format(err.message || err)));
		});
	},

	showLog: function() {
		return fs.exec('/sbin/logread', [ '-e', 'ha-device-tracker' ]).then(function(res) {
			var output = (res.stdout || '').trim();

			if (res.code !== 0)
				throw new Error(res.stderr || _('Unable to read logs'));

			ui.showModal(_('HA Device Tracker log'), [
				E('div', { 'class': 'cbi-section' }, [
					E('pre', {
						'style': 'max-height: 60vh; overflow: auto; white-space: pre-wrap; word-break: break-word;'
					}, [ output || _('No matching log entries found.') ])
				]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.hideModal
					}, [ _('Close') ])
				])
			]);
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Unable to open log: %s').format(err.message || err)));
		});
	},

	render: function(data) {
		var m, s, o;
		var serviceStatus = data ? data[1] : null;

		m = new form.Map(
			'ha-device-tracker',
			_('HA Device Tracker'),
			_('Configure Home Assistant connection, room detection and tracked Wi-Fi devices.')
		);

		s = m.section(form.NamedSection, 'ha', 'ha-device-tracker', _('Home Assistant'));

		o = s.option(form.Value, 'url', _('Home Assistant URL'));
		o.datatype = 'string';
		o.placeholder = 'http://homeassistant.local:8123';
		o.rmempty = false;
		o.description = _('Base URL of your Home Assistant instance, including the port if needed.');

		o = s.option(form.Value, 'token', _('Access token'));
		o.password = true;
		o.rmempty = false;
		o.description = _('Long-lived access token for updating device_tracker entities.');

		o = s.option(form.DummyValue, '_service_status', _('Service status'));
		o.cfgvalue = L.bind(function() {
			return this.getServiceRunning(serviceStatus) ? _('Running') : _('Stopped');
		}, this);
		o.description = _('Current service state.');

		o = s.option(form.Button, '_start', _('Start'));
		o.inputstyle = 'add';
		o.onclick = ui.createHandlerFn(this, 'runAction', 'start');

		o = s.option(form.Button, '_stop', _('Stop'));
		o.inputstyle = 'remove';
		o.onclick = ui.createHandlerFn(this, 'runAction', 'stop');

		o = s.option(form.Button, '_restart', _('Restart'));
		o.inputstyle = 'apply';
		o.onclick = ui.createHandlerFn(this, 'runAction', 'restart');

		o = s.option(form.Button, '_log', _('View log'));
		o.inputstyle = 'action';
		o.onclick = ui.createHandlerFn(this, 'showLog');

		s = m.section(form.NamedSection, 'network', 'ha-device-tracker', _('Network'));

		o = s.option(form.Value, 'room', _('Explicit room'));
		o.placeholder = _('Leave empty to derive it from hostname');
		o.description = _('If empty, derive the room name from the router hostname after stripping the prefix below.');

		o = s.option(form.Value, 'host_prefix', _('Hostname prefix to strip'));
		o.placeholder = 'openwrt-';
		o.depends({ room: '' });
		o.description = _('Used only when Explicit room is empty. Example: hostname `openwrt-kitchen` with prefix `openwrt-` yields room `kitchen`.');

		o = s.option(form.Flag, 'track_all_ifaces', _('Track all Wi-Fi interfaces'));
		o.default = '0';
		o.rmempty = false;
		o.description = _('Track all hostapd interfaces. If enabled, the interface pattern below is ignored.');

		o = s.option(form.Value, 'iface_pattern', _('Interface pattern'));
		o.placeholder = '*-main-*';
		o.depends('track_all_ifaces', '0');
		o.description = _('Shell wildcard used to select tracked Wi-Fi interfaces when Track all Wi-Fi interfaces is disabled.');

		s = m.section(form.GridSection, 'device', _('Tracked devices'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.description = _('Each row maps a MAC address to the device name stored in the section name.');

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.datatype = 'macaddr';
		o.rmempty = false;

		o = s.option(form.Value, 'user', _('Person'));
		o.rmempty = false;

		return m.render().then(L.bind(function(mapNode) {
			return mapNode;
		}, this));
	}
});
