# ha-device-tracker

**Push-based Wi‑Fi client presence tracking from OpenWrt to Home Assistant** — no polling.
`hostapd_cli` triggers an action script on `AP-STA-CONNECTED` / `AP-STA-DISCONNECTED`; the script reads a UCI config and updates the entity state in Home Assistant via REST.

## Features

- Real-time presence updates (no polling)
- Runs on OpenWrt using `hostapd_cli -a`
- UCI configuration (`/etc/config/ha-device-tracker`)
- OpenWrt package recipe for SDK/buildroot
- Simple fleet installer (`install/install.sh`) to deploy to many routers
- Legacy cleanup script (`install/cleanup-legacy.sh`)
- Updates HA via **REST**: `POST /api/states/<entity_id>` (with `Authorization: Bearer <token>`)

## Requirements

**On the router (OpenWrt):**
- `hostapd_cli` (ships with hostapd)
- `ubus`, `uci` (standard)
- `curl` (to call HA REST)
- `logger` (busybox; logs visible via `logread`)

**In Home Assistant:**
- Address reachable from the router (e.g., `http://homeassistant.local:8123`)
- A user **Long-Lived Access Token** (Profile → Long-Lived Tokens)

**On the build/deployment machine:**
- Debian or another Linux environment recommended for OpenWrt SDK/buildroot
- `bash`, `ssh`, `scp` with network access to the routers

## Repository layout

```
ha-device-tracker/
  ├─ Makefile                       # OpenWrt package recipe
  ├─ files/
  │  └─ etc/
  │     ├─ ha-device-tracker        # action hook
  │     ├─ init.d/
  │     │  └─ ha-device-tracker     # init.d service
  │     └─ config/
  │        └─ ha-device-tracker     # base UCI config template
  └─ config/
     ├─ ha-device-tracker.izsky     # site configs
     ├─ ha-device-tracker.oasis
     ├─ ha-device-tracker.lory
     └─ ha-device-tracker.nika
install/
  ├─ install.sh             # rollout to groups → IPs
  ├─ cleanup-legacy.sh      # remove old hostapd_action deployment
  └─ destinations           # site → list of IP addresses
```

## Build package

The project is now structured as an OpenWrt package directory that can be used
from an OpenWrt SDK/buildroot as a local feed package.

The package recipe is:

- `ha-device-tracker/Makefile`

The package payload is:

- `ha-device-tracker/files/etc/ha-device-tracker`
- `ha-device-tracker/files/etc/init.d/ha-device-tracker`
- `ha-device-tracker/files/etc/config/ha-device-tracker`

Build the package with OpenWrt tooling on a Debian/Linux machine, then place
the resulting `.ipk` into `dist/`.

## Installation & rollout

1) Prepare the **UCI config** for your site in `ha-device-tracker/config/ha-device-tracker.<site>`.

Minimal example:

```conf
config ha-device-tracker 'ha'
    option token 'eyJhbGciOi...'          # HA token
    option url   'http://ha.local:8123'   # HA base URL (without /api)

config ha-device-tracker 'network'
    option host_prefix 'ap-'              # optional: derive room from hostname, e.g. ap-kitchen -> kitchen
    option room ''                        # optional override for derived room
    option track_all_ifaces '0'           # 1 = listen on all hostapd interfaces
    option iface_pattern '*-main-*'       # used when track_all_ifaces is 0

# Optional: explicit device mapping
# config device 'iphone_ivan'
#     option mac  'AA:BB:CC:DD:EE:FF'
#     option user 'ivan'                  # any attributes you use in entity_id
```

Use Home Assistant-safe names for device sections and room names: lowercase
letters, digits, and underscores only.

2) Fill `install/destinations` with your target groups/IPs:

```
site1:10.8.25.3 10.8.25.4 10.8.25.1 10.8.25.5
site2:10.8.26.1 10.8.26.10 10.8.26.11 10.8.26.12
```

3) Run the **installer**:

```bash
cd install
# Deploy to all groups:
./install.sh

# Deploy to a single group (e.g., izsky):
./install.sh izsky

# Deploy to a single IP:
./install.sh 10.8.25.4
```

The installer performs for each IP in the selected group:
- copies `cleanup-legacy.sh` to `/tmp/` and runs it
- uploads the latest `ha-device-tracker_*.ipk` from `dist/`
- installs the package via `opkg install`
- copies `../ha-device-tracker/config/ha-device-tracker.<group>` → `/etc/config/ha-device-tracker`
- restarts the service: `/etc/init.d/ha-device-tracker restart`

## Legacy cleanup

If a router still has the old `hostapd_action` files deployed, run the
cleanup script once to remove them safely:

```sh
./cleanup-legacy.sh
```

The script:
- stops and disables `/etc/init.d/hostapd_action` if it exists
- removes `/etc/hostapd_action`
- removes `/etc/init.d/hostapd_action`
- removes `/etc/config/hostapd_action`
- restarts `/etc/init.d/ha-device-tracker` if it exists

## How it works

- The **init.d service** (`/etc/init.d/ha-device-tracker`) discovers AP interfaces
  via `hostapd_cli interface` and uses procd to keep one `hostapd_cli` action
  listener running per AP interface. This registers the **action script** for
  hostapd events on that interface.
  By default, it listens only on interfaces matching `*-main-*`; you can
  change the pattern with `option iface_pattern` or listen on all interfaces
  with `option track_all_ifaces '1'`.

- The **action script** (`/etc/ha-device-tracker`) receives:

  ```text
  $1 = interface, $2 = action, $3 = mac
  ```

  On `AP-STA-CONNECTED` / `AP-STA-DISCONNECTED`, it:
  1) reads the UCI config `ha-device-tracker` (sections `ha`, `network`, optional `device`),
  2) resolves the room from `option room` or, if empty, derives it from the router hostname using `option host_prefix`,
  3) constructs an `entity_id` (for example `device_tracker.<device>_<room>`),
  4) calls **HA REST** (`curl`) on `"$HA_URL/api/states/$entity_id"` with the Bearer token, sending the new state and attributes.

- On service startup, the init script also checks whether each configured device
  is already associated with one of the tracked AP interfaces and sends an
  initial `online` / `offline` update to Home Assistant immediately. This
  state is detected at runtime and is not written back into UCI.

> The script uses the system `logger -t ha-device-tracker`; check `logread` on the router.

## Verification

On the router:

```sh
# Service and event logs:
logread -f | grep -i ha-device-tracker

# AP interfaces known to hostapd:
hostapd_cli interface

# Event monitor (diagnostics):
ubus monitor | grep -E 'hostapd|sta-connected|sta-disconnected'
```

From the router, verify HA API reachability:

```sh
curl -i -H "Authorization: Bearer <TOKEN>" http://ha.local:8123/api/
```

## Troubleshooting

- **HA unreachable** from the router → check `option url`, DNS/routing/firewall.
- **Invalid/expired token** → create a new Long-Lived Token.
- **No events** → ensure `hostapd_cli interface` shows your AP interfaces and `/etc/init.d/ha-device-tracker status` reports the service running.
- **Wrong `entity_id`** → review your device section names and room resolution (`option room` or hostname derived via `option host_prefix`), and normalize invalid chars to `_`.
- **No tracked interfaces** → check `option track_all_ifaces` / `option iface_pattern` against the output of `hostapd_cli interface`.
