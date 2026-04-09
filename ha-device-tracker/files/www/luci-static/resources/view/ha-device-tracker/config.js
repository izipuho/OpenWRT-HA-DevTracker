'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';
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

	updateStatusPanel: function(serviceStatus) {
		var running;

		if (!this.statusNodes)
			return;

		running = this.getServiceRunning(serviceStatus);

		this.statusNodes.service.textContent = running ? _('Running') : _('Stopped');

		if (this.statusNodes.start)
			this.statusNodes.start.disabled = running;

		if (this.statusNodes.stop)
			this.statusNodes.stop.disabled = !running;

		if (this.statusNodes.restart)
			this.statusNodes.restart.disabled = !running;
	},

	runAction: function(action) {
		var self = this;

		return fs.exec('/etc/init.d/ha-device-tracker', [ action ]).then(function(res) {
			if (res.code !== 0)
				throw new Error(res.stderr || _('Command failed'));

			return self.loadServiceStatus().then(function(serviceStatus) {
				self.updateStatusPanel(serviceStatus);
				ui.addNotification(null, E('p', {}, _('Action completed successfully.')));
			});
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

	renderActionSection: function(serviceStatus) {
		var self = this;

		this.statusNodes = {
			service: E('span', {}, [ _('Unknown') ]),
			start: E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, 'runAction', 'start')
			}, [ _('Start') ]),
			stop: E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, 'runAction', 'stop')
			}, [ _('Stop') ]),
			restart: E('button', {
				'class': 'btn cbi-button',
				'click': ui.createHandlerFn(this, 'runAction', 'restart')
			}, [ _('Restart') ])
		};

		this.updateStatusPanel(serviceStatus);

		poll.add(function() {
			return self.loadServiceStatus().then(function(nextStatus) {
				self.updateStatusPanel(nextStatus);
			});
		});

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ _('Actions') ]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Service controls') ]),
				E('div', {
					'class': 'cbi-value-field',
					'style': 'display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;'
				}, [
					this.statusNodes.start,
					this.statusNodes.stop,
					this.statusNodes.restart,
					E('button', {
						'class': 'btn cbi-button',
						'click': ui.createHandlerFn(this, 'showLog')
					}, [ _('Open log') ])
				])
			])
		]);
	},

	render: function(data) {
		var m, s, o;
		var serviceStatus = data ? data[1] : null;

		this.statusNodes = {
			service: E('span', {}, [ this.getServiceRunning(serviceStatus) ? _('Running') : _('Stopped') ])
		};

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
		o.description = _('Long-lived access token used to update device_tracker entities.');

		o = s.option(form.DummyValue, '_service_status', _('Service status'));
		o.rawhtml = true;
		o.cfgvalue = L.bind(function() {
			return this.statusNodes.service.outerHTML;
		}, this);
		o.description = _('Current runtime status of the tracker service.');

		s = m.section(form.NamedSection, 'network', 'ha-device-tracker', _('Network'));

		o = s.option(form.Value, 'room', _('Explicit room'));
		o.placeholder = _('Leave empty to derive it from hostname');
		o.description = _('Set a fixed room name here. If left empty, the room is derived from the router hostname after removing the hostname prefix below.');

		o = s.option(form.Value, 'host_prefix', _('Hostname prefix to strip'));
		o.placeholder = 'openwrt-';
		o.depends({ room: '' });
		o.description = _('Used only when Explicit room is empty. Example: hostname `openwrt-kitchen` with prefix `openwrt-` becomes room `kitchen`.');

		o = s.option(form.Flag, 'track_all_ifaces', _('Track all Wi-Fi interfaces'));
		o.default = '0';
		o.rmempty = false;
		o.description = _('Enable this to watch every hostapd interface. When enabled, the interface pattern below is ignored.');

		o = s.option(form.Value, 'iface_pattern', _('Interface pattern'));
		o.placeholder = '*-main-*';
		o.depends('track_all_ifaces', '0');
		o.description = _('Shell wildcard used to select which Wi-Fi interfaces should be tracked when Track all Wi-Fi interfaces is disabled.');

		s = m.section(form.GridSection, 'device', _('Tracked devices'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.description = _('Each row maps one MAC address to the Home Assistant device name stored in the section name.');

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.datatype = 'macaddr';
		o.rmempty = false;

		o = s.option(form.Value, 'user', _('Person'));
		o.rmempty = false;

		return m.render().then(L.bind(function(mapNode) {
			return E('div', {}, [
				mapNode,
				this.renderActionSection(serviceStatus)
			]);
		}, this));
	}
});
