# OpenWRT-HA-DevTracker

**Push-based Wi‑Fi client presence tracking from OpenWrt to Home Assistant** — no polling.
`hostapd_cli` triggers an action script on `AP-STA-CONNECTED` / `AP-STA-DISCONNECTED`; the script reads a UCI config and updates the entity state in Home Assistant via REST.

## Features

- Real-time presence updates (no polling)
- Runs on OpenWrt using `hostapd_cli -a`
- UCI configuration (`/etc/config/hostapd_action`)
- Simple fleet installer (`installer/install.sh`) to deploy to many routers
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

**On the deployment machine (for `installer/install.sh`):**
- `bash`, `ssh`, `scp` with network access to the routers

## Repository layout

```
hostapd_action              # action hook (gets copied to /etc/hostapd_action)
init.d/
  └─ hostapd_action         # init.d service (to /etc/init.d/hostapd_action)
config/
  ├─ hostapd_action.izsky   # UCI configs per site
  ├─ hostapd_action.oasis
  ├─ hostapd_action.lory
  └─ hostapd_action.nika
installer/
  ├─ install.sh             # rollout to groups → IPs
  └─ destinations           # group → list of IP addresses
```

## Installation & rollout

1) Prepare the **UCI config** for your site in `config/hostapd_action.<site>`.

Minimal example:

```conf
config hostapd_action 'ha'
    option token 'eyJhbGciOi...'          # HA token
    option url   'http://ha.local:8123'   # HA base URL (without /api)

config hostapd_action 'network'
    option host_prefix 'device_tracker'   # namespace/prefix if used to build entity_id
    list IFACE 'wlan0'                    # AP interfaces (add more if needed)
    # list IFACE 'wlan1'

# Optional: explicit device mapping
# config device 'iphone_ivan'
#     option mac  'AA:BB:CC:DD:EE:FF'
#     option user 'ivan'                  # any attributes you use in entity_id
```

> Note: in one sample there was a typo `optoin user` — it must be `option user`.

2) Fill `installer/destinations` with your target groups/IPs:

```
izsky:10.8.25.3 10.8.25.4 10.8.25.1 10.8.25.5
oasis:10.8.26.1 10.8.26.10 10.8.26.11 10.8.26.12
lory:10.8.27.1 10.8.27.2
nika:10.8.28.1 10.8.28.2
```

3) Run the **installer**:

```bash
cd installer
# Deploy to all groups:
./install.sh

# Deploy to a single group (e.g., izsky):
./install.sh izsky
```

The installer performs for each IP in the selected group:
- copies `../hostapd_action` → `/etc/` and sets `chmod +x`
- copies `../init.d/hostapd_action` → `/etc/init.d/` and sets `chmod +x`
- copies `../config/hostapd_action.<group>` → `/etc/config/hostapd_action`
- kills any previous `hostapd_cli`
- enables and starts the service: `/etc/init.d/hostapd_action enable && start`

## How it works

- The **init.d service** (`/etc/init.d/hostapd_action`) discovers AP interfaces
  via `hostapd_cli interface` and runs, per interface:

  ```bash
  hostapd_cli -a /etc/hostapd_action -r -B -P /var/run/hostapd_action_<iface>.pid -i <iface>
  ```

  This registers the **action script** for hostapd events on that interface.

- The **action script** (`/etc/hostapd_action`) receives:

  ```text
  $1 = interface, $2 = action, $3 = mac
  ```

  On `AP-STA-CONNECTED` / `AP-STA-DISCONNECTED`, it:
  1) reads the UCI config `hostapd_action` (sections `ha`, `network`, optional `device`),
  2) constructs an `entity_id` (based on your mapping/template),
  3) calls **HA REST** (`curl`) on `"$HA_URL/api/states/$entity_id"` with the Bearer token, sending the new state and attributes.

> The script uses the system `logger -t hostapd_action`; check `logread` on the router.

## Verification

On the router:

```sh
# Service and event logs:
logread -f | grep -i hostapd_action

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
- **No events** → ensure `hostapd_cli interface` shows your `wlan*`, service is running, and PID files are created.
- **Wrong `entity_id`** → review your mapping/normalization (lowercase, replace invalid chars with `_`).

## Security

- Prefer an internal HA URL; use HTTPS if crossing networks.
- Do not commit tokens to the repo (keep them only on devices).
- Use a dedicated technical user/token with minimum required permissions.

## License

Add your license (e.g., MIT) in `LICENSE`.
