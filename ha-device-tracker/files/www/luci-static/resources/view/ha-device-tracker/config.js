'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load: function() {
		return uci.load('ha-device-tracker');
	},

	render: function() {
		var m, s, o;

		m = new form.Map(
			'ha-device-tracker',
			_('HA Device Tracker'),
			_('Configure Home Assistant connection, room detection and tracked Wi-Fi devices.')
		);

		s = m.section(form.NamedSection, 'ha', 'ha-device-tracker', _('Home Assistant'));

		o = s.option(form.Value, 'url', _('Base URL'));
		o.datatype = 'string';
		o.placeholder = 'http://homeassistant.local:8123';
		o.rmempty = false;

		o = s.option(form.Value, 'token', _('Access token'));
		o.password = true;
		o.rmempty = false;

		s = m.section(form.NamedSection, 'network', 'ha-device-tracker', _('Network'));

		o = s.option(form.Value, 'room', _('Room name'));
		o.placeholder = _('Leave empty to derive it from hostname');

		o = s.option(form.Value, 'host_prefix', _('Hostname prefix'));
		o.placeholder = 'openwrt-';
		o.depends({ room: '' });

		o = s.option(form.Flag, 'track_all_ifaces', _('Track all Wi-Fi interfaces'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'iface_pattern', _('Interface pattern'));
		o.placeholder = '*-main-*';
		o.depends('track_all_ifaces', '0');

		s = m.section(form.GridSection, 'device', _('Tracked devices'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.datatype = 'macaddr';
		o.rmempty = false;

		o = s.option(form.Value, 'user', _('User'));
		o.rmempty = false;

		return m.render();
	}
});
