# Test Checklist

Before calling this `v1`, run the following checks:

- [ ] 1. End-to-end happy path on a real router.
   Install the package, open LuCI, save the config, start the service, and confirm that presence updates appear in Home Assistant.

- [ ] 2. Negative scenarios.
   Verify behavior for an empty `room`, invalid `token` or `url`, and no matching Wi-Fi interfaces.

- [ ] 3. LuCI service state.
   Confirm that the displayed `Running` / `Stopped` state matches the actual service state, and that `Start` / `Stop` / `Restart` behave correctly.

- [ ] 4. Config contract.
   Confirm that the supported UCI model is stable: the package uses `/etc/config/ha-device-tracker`, and the tracked device name is derived from the `device` section name.

- [ ] 5. UI acceptance.
   Confirm that the current LuCI labels, layout, and tracked-devices table are acceptable for `v1`.

- [ ] 6. Startup output and logging.
   Confirm that startup stdout is acceptable and that syslog contains enough information for troubleshooting.

- [ ] 7. Release artifact validation.
   Build the exact package intended for release, install that artifact on a target router, and verify that it matches the tested behavior.
