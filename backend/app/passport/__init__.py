"""Passport sync consumer.

Projects the Passport webhook feed (org / membership / entitlement / identity-link
events) into local read-model tables (``app/models/passport.py``) and reads them on the
request path. Mutations flow *up* via the ``passport_client`` SDK and come *back down*
via sync — this app never mints these aggregates.

Access is DERIVED per-brand at the point of the check (rule 8) — Prepper keeps no local role
vocabulary and no ``outlets`` table. Reads come from the projection, never from Passport's API.

Module layout:

- ``store``       — pure, synchronous persistence + the version guard. No SDK import;
                    fully unit-testable on SQLite.
- ``handlers``    — the 17 ``SyncHandlers`` methods (SDK-typed adapters → ``store``).
- ``access``      — request-path access derivation via ``passport_client.access``
                    (``has_app_access`` / ``roles_at_brands``); brand-scoped role reads.
- ``directory``   — projection-first read-model queries (brands, role roster, members).
- ``sync_router`` — mounts the ``build_sync_router`` receive endpoint.
- ``identity``    — writes the (app, subject) identity link LOCALLY for the Model 3 callback.
- ``reconcile``   — nightly ``snapshot()`` reconciliation (server-side job, no polling).

**Prepper is a READ-ONLY consumer as of 2026-08-13.** It writes nothing to Passport: no role
write-back, no identity reporting. Roles, memberships and invitations are managed in Passport's
dashboard and arrive here through sync. The SDK treats write-back as optional, so this is a
conforming shape — but do not "restore" ``writeback.py`` from git history without that being a
deliberate product decision, because the UI that drove it is gone too.

Only ``handlers`` / ``sync_router`` / ``reconcile`` / ``access``
import ``passport_client``, and the request-path modules do so lazily / behind guards, so the
pure ``store`` layer and its tests run whether or not the private SDK is installed.
"""
