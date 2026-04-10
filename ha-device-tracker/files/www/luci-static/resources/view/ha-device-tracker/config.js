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
		var service, instances, instanceName;

		if (!serviceStatus)
			return false;

		service = serviceStatus['ha-device-tracker'] || serviceStatus;

		if (Array.isArray(service))
			service = service[0] || {};

		if (typeof service.running === 'boolean')
			return service.running;

		instances = service.instances || {};

		for (instanceName in instances)
			if (instances[instanceName].running)
				return true;

		return false;
	},

	delay: function(ms) {
		return new Promise(function(resolve) {
			window.setTimeout(resolve, ms);
		});
	},

	pollServiceStatus: function(expectedRunning, attempts, delayMs) {
		var self = this;

		return this.loadServiceStatus().then(function(serviceStatus) {
			if (self.getServiceRunning(serviceStatus) === expectedRunning || attempts <= 1)
				return (self.getServiceRunning(serviceStatus) === expectedRunning) ? serviceStatus : null;

			return self.delay(delayMs).then(function() {
				return self.pollServiceStatus(expectedRunning, attempts - 1, delayMs);
			});
		});
	},

	updateServiceControls: function(serviceStatus) {
		var running;

		if (!this.serviceNodes)
			return;

		running = this.getServiceRunning(serviceStatus);

		this.serviceNodes.status.textContent = running ? _('Running') : _('Stopped');

		if (running) {
			this.serviceNodes.start.setAttribute('disabled', 'disabled');
			this.serviceNodes.stop.removeAttribute('disabled');
			this.serviceNodes.restart.removeAttribute('disabled');
		}
		else {
			this.serviceNodes.start.removeAttribute('disabled');
			this.serviceNodes.stop.setAttribute('disabled', 'disabled');
			this.serviceNodes.restart.setAttribute('disabled', 'disabled');
		}
	},

	runAction: function(action) {
		var self = this;
		var expectedRunning = (action !== 'stop');
		var messages = {
			start: _('Service started.'),
			stop: _('Service stopped.'),
			restart: _('Service restarted.')
		};

		return fs.exec('/etc/init.d/ha-device-tracker', [ action ]).then(function(res) {
			if (res.code !== 0)
				throw new Error(res.stderr || _('Command failed'));

			self.updateServiceControls({ running: expectedRunning });

			return self.pollServiceStatus(expectedRunning, 8, 250).then(function(serviceStatus) {
				if (serviceStatus)
					self.updateServiceControls(serviceStatus);

				ui.addNotification(null, E('p', {}, messages[action] || _('Action completed successfully.')));
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

	renderServiceRow: function(running) {
		var statusNode = E('span', {}, [ running ? _('Running') : _('Stopped') ]);
		var startAttrs = {
			'class': 'btn cbi-button cbi-button-add',
			'click': ui.createHandlerFn(this, 'runAction', 'start'),
			'type': 'button'
		};
		var stopAttrs = {
			'class': 'btn cbi-button cbi-button-remove',
			'click': ui.createHandlerFn(this, 'runAction', 'stop'),
			'type': 'button'
		};
		var restartAttrs = {
			'class': 'btn cbi-button cbi-button-apply',
			'click': ui.createHandlerFn(this, 'runAction', 'restart'),
			'type': 'button'
		};
		var startNode, stopNode, restartNode, row;

		if (running)
			startAttrs.disabled = 'disabled';
		else {
			stopAttrs.disabled = 'disabled';
			restartAttrs.disabled = 'disabled';
		}

		row = E('div', {
			'style': 'display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; width:100%;'
		}, [
			E('div', {
				'style': 'display:flex; align-items:center; gap:.5rem; flex-wrap:wrap;'
			}, [
				statusNode
			]),
			E('div', {
				'style': 'display:flex; align-items:center; gap:.5rem; flex-wrap:wrap; justify-content:flex-end;'
			}, [
				(startNode = E('button', startAttrs, [ _('Start') ])),
				(stopNode = E('button', stopAttrs, [ _('Stop') ])),
				(restartNode = E('button', restartAttrs, [ _('Restart') ])),
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, 'showLog'),
					'type': 'button'
				}, [ _('View log') ])
			])
		]);

		this.serviceNodes = {
			status: statusNode,
			start: startNode,
			stop: stopNode,
			restart: restartNode
		};

		return row;
	},

	render: function(data) {
		var m, s, o, running;
		var serviceStatus = data ? data[1] : null;
		running = this.getServiceRunning(serviceStatus);

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

		o = s.option(form.DummyValue, '_service', _('Service'));
		o.cfgvalue = function() {
			return '';
		};
		o.description = _('Current service state and controls.');

		s = m.section(form.NamedSection, 'network', 'ha-device-tracker', _('Network'));

		o = s.option(form.Value, 'room', _('Explicit room'));
		o.placeholder = _('Leave empty to derive it from hostname');
		o.description = _('If empty, derive the room name from the router hostname after stripping the prefix below.');

		o = s.option(form.Value, 'host_prefix', _('Hostname prefix to strip'));
		o.depends({ room: '' });
		o.description = _('Used only when Explicit room is empty. Example: hostname `openwrt-kitchen` with prefix `openwrt-` yields room `kitchen`.');

		o = s.option(form.Flag, 'track_all_ifaces', _('Track all Wi-Fi interfaces'));
		o.default = '0';
		o.rmempty = false;
		o.description = _('Track all hostapd interfaces. If enabled, the interface pattern below is ignored. Changes take effect after Save & Apply.');

		o = s.option(form.Value, 'iface_pattern', _('Interface pattern'));
		o.depends('track_all_ifaces', '0');
		o.description = _('Shell wildcard used to select tracked Wi-Fi interfaces when Track all Wi-Fi interfaces is disabled. Example: `*-main-*`. Changes take effect after Save & Apply.');
		o.validate = function(section_id, value) {
			var trackAllOpt = this.map.lookupOption('track_all_ifaces', section_id)[0];
			var trackAll = trackAllOpt ? trackAllOpt.formvalue(section_id) : '0';

			if (trackAll === '1')
				return true;

			if (value != null && value.trim() !== '')
				return true;

			return _('Interface pattern must not be empty when Track all Wi-Fi interfaces is disabled.');
		};

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
			var serviceField = mapNode.querySelector('[data-name="_service"] .cbi-value-field');
			var ifacePatternOpt = m.lookupOption('iface_pattern', 'network')[0];
			var ifacePatternWidget = ifacePatternOpt ? ifacePatternOpt.getUIElement('network') : null;
			var ifacePatternInput = ifacePatternWidget && ifacePatternWidget.node
				? ifacePatternWidget.node.querySelector('input')
				: null;

			if (serviceField) {
				serviceField.innerHTML = '';
				serviceField.appendChild(this.renderServiceRow(running));
			}

			if (ifacePatternWidget && ifacePatternInput) {
				ifacePatternWidget.setUpdateEvents(ifacePatternInput, 'input');
				ifacePatternWidget.setChangeEvents(ifacePatternInput, 'input');
			}

			return mapNode;
		}, this));
	}
});
