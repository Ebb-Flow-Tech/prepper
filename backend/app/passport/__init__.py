"""Passport sync consumer.

Projects the Passport webhook feed (org / membership / entitlement / identity-link
events) into local read-model tables (``app/models/passport.py``) and reads them on the
request path. Mutations flow *up* via the ``passport_client`` SDK and come *back down*
via sync — this app never mints these aggregates.

Module layout:

- ``store``           — pure, synchronous persistence + the version guard. No SDK import;
                        fully unit-testable on SQLite.
- ``role_projection`` — maps a Passport org role onto the local ``users.user_type`` and
                        revokes local unit-scoped grants on membership removal. No SDK import.
- ``handlers``        — the 12 ``SyncHandlers`` methods (SDK-typed adapters → ``store``).
- ``sync_router``     — mounts the ``build_sync_router`` receive endpoint.
- ``identity``        — reports the (app, subject) identity link to Passport on login.
- ``reconcile``       — nightly ``snapshot()`` reconciliation (server-side job, no polling).

Only ``handlers`` / ``sync_router`` / ``identity`` / ``reconcile`` import ``passport_client``,
and only lazily / behind guards, so the rest of the app and the existing test-suite run
unchanged whether or not the private SDK is installed.
"""
