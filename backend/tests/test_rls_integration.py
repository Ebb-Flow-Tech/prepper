"""PostgreSQL Row-Level Security (RLS) integration tests.

These tests bypass FastAPI entirely and query the database directly, simulating
what a Supabase JS client does when a user is authenticated:

  1.  Connect with the service role (superuser / BYPASSRLS) to insert test data.
  2.  Within the same transaction, switch to the ``authenticated`` role and inject
      a JWT sub claim via ``set_config`` — this is exactly what PostgREST does
      before running every user request.
  3.  Run raw SQL queries against the tables and assert that the RLS policies
      allow or deny access as expected.
  4.  Roll back the entire transaction so no test data persists.

PREREQUISITES
-------------
* DATABASE_URL must point to Supabase PostgreSQL (not SQLite).
  Tests are automatically skipped otherwise.
* The ``authenticated`` PostgreSQL role must exist (created by Supabase).
* The RLS helper functions must be deployed:
      python -m scripts.helpers.apply_all
* The RLS migration must have been applied:
      alembic upgrade head

Run only these tests:
    DATABASE_URL=postgresql://... pytest tests/test_rls_integration.py -v
"""

import importlib.util
import pathlib
import uuid
from contextlib import contextmanager

import pytest
from sqlalchemy import create_engine, text

from app.config import get_settings

_settings = get_settings()
_IS_POSTGRES = _settings.database_url.startswith("postgresql")

pytestmark = pytest.mark.skipif(
    not _IS_POSTGRES,
    reason="RLS integration tests require PostgreSQL — set DATABASE_URL to Supabase",
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture(scope="module")
def pg_engine():
    engine = create_engine(_settings.database_url)
    yield engine
    engine.dispose()


@pytest.fixture(scope="module", autouse=True)
def check_rls_prerequisites(pg_engine):
    """Skip the entire module if the authenticated role or helpers are missing."""
    with pg_engine.connect() as c:
        role = c.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'")
        ).fetchone()
        if not role:
            pytest.skip(
                "RLS tests require the 'authenticated' PostgreSQL role "
                "(created automatically by Supabase)."
            )
        fn = c.execute(
            text(
                "SELECT 1 FROM pg_proc "
                "WHERE proname = 'is_admin' "
                "  AND pronamespace = 'public'::regnamespace"
            )
        ).fetchone()
        if not fn:
            pytest.skip(
                "RLS helper functions not deployed. "
                "Run: python -m scripts.helpers.apply_all"
            )


def _load_rls_migration():
    """Load the p4 migration module so the tests use ITS is_admin/is_manager_or_admin SQL verbatim
    — one source of truth. p4 re-qualifies the helpers for the `passport` schema (design 2026-07-15);
    the p3 bodies referenced the pre-move `public.passport_*` names and no longer resolve. This
    decouples the tests from deploy timing: they verify the current projection-derived functions
    regardless of what is live on the target DB."""
    path = (
        pathlib.Path(__file__).resolve().parent.parent
        / "alembic"
        / "versions"
        / "p4rtschema7n8o_move_passport_projection_to_schema.py"
    )
    spec = importlib.util.spec_from_file_location("_p4_rls", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture()
def conn(pg_engine):
    """Service-role connection whose transaction is always rolled back.

    Used for test setup (insert data) and for SELECT / UPDATE assertions.
    The full rollback at the end guarantees no test data escapes into the DB.

    It first installs the projection-derived RLS helper definitions (from the p3 migration) INSIDE
    the transaction. `CREATE OR REPLACE FUNCTION` is transactional, so the redefinition rolls back
    with everything else — the target DB's live functions are never mutated — while every assertion
    in the test runs against the current, correct definitions rather than whatever is deployed.
    """
    with pg_engine.connect() as connection:
        trans = connection.begin()
        _install_rls_functions(connection)
        try:
            yield connection
        finally:
            trans.rollback()


def _install_rls_functions(connection) -> None:
    """Redefine is_admin/is_manager_or_admin (projection-derived, from the p3 migration) inside the
    caller's transaction. Any connection that will evaluate RLS must call this — including a second
    connection a test opens to probe a policy violation without corrupting the primary one."""
    rls = _load_rls_migration()
    connection.execute(text(rls._IS_ADMIN_SCHEMA))
    connection.execute(text(rls._IS_MANAGER_OR_ADMIN_SCHEMA))


# =============================================================================
# Helpers
# =============================================================================


@contextmanager
def as_user(conn, user_id: str):
    """Temporarily switch to the ``authenticated`` role for the given user.

    Mechanism
    ---------
    1.  Create a SAVEPOINT — this is the "before-role-change" snapshot.
    2.  SET LOCAL ROLE authenticated — restricts the session to user privileges.
    3.  set_config('request.jwt.claim.sub', uid, true) — auth.uid() reads this.
    4.  On exit (success or error): ROLLBACK TO SAVEPOINT resets both the role
        and the jwt claim, leaving the connection in its original service-role
        state for the next operation in the same test.
    """
    sp = f"rls_{uuid.uuid4().hex[:8]}"
    conn.execute(text(f"SAVEPOINT {sp}"))
    conn.execute(text("SET LOCAL ROLE authenticated"))
    conn.execute(
        text("SELECT set_config('request.jwt.claim.sub', :uid, true)"),
        {"uid": user_id},
    )
    try:
        yield
    finally:
        conn.execute(text(f"ROLLBACK TO SAVEPOINT {sp}"))


def uid() -> str:
    """Generate a UUID-format test user ID.

    Supabase's auth.uid() casts the JWT sub claim to the ``uuid`` type before
    returning it, so user IDs in RLS helper functions must be valid UUIDs.
    """
    return str(uuid.uuid4())


def insert_user(
    conn,
    user_id: str,
    *,
    user_type: str = "NORMAL",
    is_manager: bool = False,
) -> None:
    """Insert a test user and seed the Passport projection so the RLS helpers derive their role.

    Rule 8: `users` no longer carries `user_type`/`is_manager` — the RLS functions `is_admin()` /
    `is_manager_or_admin()` now derive from the projection (`identity_link -> membership` for admin,
    `identity_link -> unit_app_membership` for manager). So `user_type="ADMIN"` seeds an active
    `Admin` org membership, and `is_manager=True` seeds an active `Manager` brand role — both bound
    to the user through an identity link whose `subject` is the user's id (== `auth.uid()`). A NORMAL
    user seeds nothing, so both helpers return false for them.
    """
    email = f"rls-{user_id[:16]}@rls-test.invalid"
    conn.execute(
        text("""
            INSERT INTO users (id, email, username, created_at, updated_at)
            VALUES (:id, :email, :username, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
        """),
        {"id": user_id, "email": email, "username": f"rls-{user_id[:24]}"},
    )

    if user_type != "ADMIN" and not is_manager:
        return  # NORMAL: no projection rows -> is_admin()/is_manager_or_admin() are false

    platform_user_id = str(uuid.uuid4())
    conn.execute(
        text("""
            INSERT INTO passport.identity_link (id, platform_user_id, app_id, subject, linked_via)
            VALUES (:id, :pu, :app, :subject, 'test')
        """),
        {"id": str(uuid.uuid4()), "pu": platform_user_id, "app": str(uuid.uuid4()),
         "subject": user_id},
    )
    if user_type == "ADMIN":
        conn.execute(
            text("""
                INSERT INTO passport.membership
                    (id, organization_id, platform_user_id, role, status, version, email)
                VALUES (:id, :org, :pu, 'Admin', 'active', 1, :email)
            """),
            {"id": str(uuid.uuid4()), "org": str(uuid.uuid4()), "pu": platform_user_id,
             "email": email},
        )
    if is_manager:
        conn.execute(
            text("""
                INSERT INTO passport.unit_app_membership
                    (id, organization_id, platform_user_id, unit_id, app_id, role, status, version)
                VALUES (:id, :org, :pu, :unit, :app, 'Manager', 'active', 1)
            """),
            {"id": str(uuid.uuid4()), "org": str(uuid.uuid4()), "pu": platform_user_id,
             "unit": str(uuid.uuid4()), "app": str(uuid.uuid4())},
        )


def insert_recipe(conn, owner_id: str, *, is_public: bool = False) -> int:
    return conn.execute(
        text("""
            INSERT INTO recipes (name, yield_quantity, yield_unit, is_prep_recipe,
                                 owner_id, is_public, status, created_by,
                                 created_at, updated_at)
            VALUES (:name, 1, 'portion', false,
                    :owner_id, :is_public, 'DRAFT', :owner_id,
                    NOW(), NOW())
            RETURNING id
        """),
        {
            "name": f"rls-recipe-{uuid.uuid4().hex[:8]}",
            "owner_id": owner_id,
            "is_public": is_public,
        },
    ).scalar_one()


def insert_tasting_session(conn, creator_id: str) -> int:
    return conn.execute(
        text("""
            INSERT INTO tasting_sessions (name, date, creator_id,
                                          created_at, updated_at)
            VALUES (:name, NOW(), :creator_id, NOW(), NOW())
            RETURNING id
        """),
        {
            "name": f"rls-session-{uuid.uuid4().hex[:8]}",
            "creator_id": creator_id,
        },
    ).scalar_one()


def add_participant(conn, session_id: int, user_id: str) -> None:
    conn.execute(
        text("""
            INSERT INTO tasting_users (tasting_session_id, user_id,
                                       created_at, updated_at)
            VALUES (:session_id, :user_id, NOW(), NOW())
        """),
        {"session_id": session_id, "user_id": user_id},
    )


def insert_ingredient(conn) -> int:
    return conn.execute(
        text("""
            INSERT INTO ingredients (name, base_unit, is_active,
                                     created_at, updated_at)
            VALUES (:name, 'g', true, NOW(), NOW())
            RETURNING id
        """),
        {"name": f"rls-ingredient-{uuid.uuid4().hex[:8]}"},
    ).scalar_one()


# =============================================================================
# Recipe RLS
# =============================================================================


class TestRecipeRLS:
    """Policies: SELECT via can_access_recipe(), UPDATE/DELETE via owns_recipe()."""

    def test_owner_sees_own_private_recipe(self, conn):
        owner = uid()
        insert_user(conn, owner)
        rid = insert_recipe(conn, owner, is_public=False)

        with as_user(conn, owner):
            row = conn.execute(
                text("SELECT id FROM recipes WHERE id = :id"), {"id": rid}
            ).fetchone()
        assert row is not None, "Owner must see their own private recipe"

    def test_non_owner_cannot_see_private_recipe(self, conn):
        """RLS silently omits the row — result is empty, no error raised."""
        owner, reader = uid(), uid()
        insert_user(conn, owner)
        insert_user(conn, reader)
        rid = insert_recipe(conn, owner, is_public=False)

        with as_user(conn, reader):
            row = conn.execute(
                text("SELECT id FROM recipes WHERE id = :id"), {"id": rid}
            ).fetchone()
        assert row is None, "Non-owner must not see private recipe (silent filter)"

    def test_any_user_can_see_public_recipe(self, conn):
        owner, reader = uid(), uid()
        insert_user(conn, owner)
        insert_user(conn, reader)
        rid = insert_recipe(conn, owner, is_public=True)

        with as_user(conn, reader):
            row = conn.execute(
                text("SELECT id FROM recipes WHERE id = :id"), {"id": rid}
            ).fetchone()
        assert row is not None, "Public recipe must be visible to any authenticated user"

    def test_admin_sees_any_private_recipe(self, conn):
        owner, admin = uid(), uid()
        insert_user(conn, owner)
        insert_user(conn, admin, user_type="ADMIN")
        rid = insert_recipe(conn, owner, is_public=False)

        with as_user(conn, admin):
            row = conn.execute(
                text("SELECT id FROM recipes WHERE id = :id"), {"id": rid}
            ).fetchone()
        assert row is not None, "Admin must see any recipe regardless of ownership"

    def test_recipe_list_silently_filters_inaccessible_rows(self, conn):
        """SELECT * returns only owned + public for a normal user."""
        owner, reader = uid(), uid()
        insert_user(conn, owner)
        insert_user(conn, reader)

        private_id = insert_recipe(conn, owner, is_public=False)
        public_id = insert_recipe(conn, owner, is_public=True)
        own_id = insert_recipe(conn, reader, is_public=False)

        with as_user(conn, reader):
            rows = conn.execute(
                text("SELECT id FROM recipes WHERE id = ANY(:ids)"),
                {"ids": [private_id, public_id, own_id]},
            ).fetchall()
        visible = {r[0] for r in rows}

        assert private_id not in visible, "Other user's private recipe must be filtered"
        assert public_id in visible, "Public recipe must be visible"
        assert own_id in visible, "Own recipe must be visible"

    def test_non_owner_update_is_silently_blocked(self, conn):
        """UPDATE on an inaccessible row affects 0 rows — no error raised."""
        owner, attacker = uid(), uid()
        insert_user(conn, owner)
        insert_user(conn, attacker)
        rid = insert_recipe(conn, owner, is_public=True)

        with as_user(conn, attacker):
            result = conn.execute(
                text("UPDATE recipes SET name = 'Hacked' WHERE id = :id"),
                {"id": rid},
            )
        assert result.rowcount == 0, "Non-owner UPDATE must affect 0 rows"

    def test_owner_can_update_own_recipe(self, conn):
        owner = uid()
        insert_user(conn, owner)
        rid = insert_recipe(conn, owner, is_public=False)

        with as_user(conn, owner):
            result = conn.execute(
                text("UPDATE recipes SET name = 'Updated' WHERE id = :id"),
                {"id": rid},
            )
        assert result.rowcount == 1, "Owner must be able to update their recipe"

    def test_admin_can_update_any_recipe(self, conn):
        owner, admin = uid(), uid()
        insert_user(conn, owner)
        insert_user(conn, admin, user_type="ADMIN")
        rid = insert_recipe(conn, owner, is_public=False)

        with as_user(conn, admin):
            result = conn.execute(
                text("UPDATE recipes SET name = 'Admin Updated' WHERE id = :id"),
                {"id": rid},
            )
        assert result.rowcount == 1, "Admin must be able to update any recipe"


# =============================================================================
# Ingredients RLS
# =============================================================================


class TestIngredientRLS:
    """Policies: SELECT for all authenticated, INSERT/UPDATE for manager/admin,
    DELETE for admin only."""

    def test_normal_user_can_read_ingredients(self, conn):
        normal = uid()
        insert_user(conn, normal)
        iid = insert_ingredient(conn)

        with as_user(conn, normal):
            row = conn.execute(
                text("SELECT id FROM ingredients WHERE id = :id"), {"id": iid}
            ).fetchone()
        assert row is not None, "Any authenticated user must be able to read ingredients"

    def test_normal_user_cannot_insert_ingredient(self, conn):
        """INSERT by a normal user must raise a RLS policy violation.

        Uses `as_user` (a SAVEPOINT), not a second connection: the failed INSERT aborts to the
        savepoint, so `conn` recovers cleanly — and, crucially, avoids two connections both trying to
        `CREATE OR REPLACE` the RLS functions, which deadlocks on the `pg_proc` row lock.
        """
        normal = uid()
        insert_user(conn, normal)

        with pytest.raises(Exception, match="row-level security|permission denied|42501"):
            with as_user(conn, normal):
                conn.execute(
                    text("INSERT INTO ingredients (name, base_unit, is_active, created_at, updated_at) "
                         "VALUES ('RLS-blocked', 'g', true, NOW(), NOW())")
                )

    def test_manager_can_insert_ingredient(self, conn):
        manager = uid()
        insert_user(conn, manager, is_manager=True)

        with as_user(conn, manager):
            row = conn.execute(
                text("""
                    INSERT INTO ingredients (name, base_unit, is_active, created_at, updated_at)
                    VALUES (:name, 'g', true, NOW(), NOW())
                    RETURNING id
                """),
                {"name": f"mgr-ing-{uuid.uuid4().hex[:8]}"},
            ).fetchone()
        assert row is not None, "Manager must be able to insert ingredients"

    def test_admin_can_insert_ingredient(self, conn):
        admin = uid()
        insert_user(conn, admin, user_type="ADMIN")

        with as_user(conn, admin):
            row = conn.execute(
                text("""
                    INSERT INTO ingredients (name, base_unit, is_active, created_at, updated_at)
                    VALUES (:name, 'g', true, NOW(), NOW())
                    RETURNING id
                """),
                {"name": f"admin-ing-{uuid.uuid4().hex[:8]}"},
            ).fetchone()
        assert row is not None, "Admin must be able to insert ingredients"

    def test_normal_user_cannot_delete_ingredient(self, conn):
        """DELETE by a normal user is silently blocked (0 rows, no error).

        PostgreSQL RLS blocks DELETE via the USING clause — the row is invisible
        to the user, so DELETE matches nothing rather than raising an error.
        Using ``conn`` (same connection) ensures the ingredient is visible
        within the open transaction even though it hasn't been committed.
        """
        normal = uid()
        insert_user(conn, normal)
        iid = insert_ingredient(conn)

        with as_user(conn, normal):
            result = conn.execute(
                text("DELETE FROM ingredients WHERE id = :id"), {"id": iid}
            )
        assert result.rowcount == 0, "Normal user DELETE must be silently blocked (0 rows)"

    def test_manager_cannot_delete_ingredient(self, conn):
        """DELETE is admin-only — manager must also be blocked (0 rows, no error)."""
        manager = uid()
        insert_user(conn, manager, is_manager=True)
        iid = insert_ingredient(conn)

        with as_user(conn, manager):
            result = conn.execute(
                text("DELETE FROM ingredients WHERE id = :id"), {"id": iid}
            )
        assert result.rowcount == 0, "Manager DELETE must be silently blocked (0 rows)"


# =============================================================================
# Tasting session RLS
# =============================================================================


class TestTastingSessionRLS:
    """Policies: SELECT via can_access_tasting_session(), UPDATE/DELETE via
    owns_tasting_session()."""

    def test_creator_sees_their_session(self, conn):
        creator = uid()
        insert_user(conn, creator)
        sid = insert_tasting_session(conn, creator)

        with as_user(conn, creator):
            row = conn.execute(
                text("SELECT id FROM tasting_sessions WHERE id = :id"), {"id": sid}
            ).fetchone()
        assert row is not None, "Creator must see their own session"

    def test_participant_sees_session(self, conn):
        creator, participant = uid(), uid()
        insert_user(conn, creator)
        insert_user(conn, participant)
        sid = insert_tasting_session(conn, creator)
        add_participant(conn, sid, participant)

        with as_user(conn, participant):
            row = conn.execute(
                text("SELECT id FROM tasting_sessions WHERE id = :id"), {"id": sid}
            ).fetchone()
        assert row is not None, "Participant must see the session they joined"

    def test_non_participant_cannot_see_session(self, conn):
        """RLS silently omits the session row — no error, just absent."""
        creator, outsider = uid(), uid()
        insert_user(conn, creator)
        insert_user(conn, outsider)
        sid = insert_tasting_session(conn, creator)

        with as_user(conn, outsider):
            row = conn.execute(
                text("SELECT id FROM tasting_sessions WHERE id = :id"), {"id": sid}
            ).fetchone()
        assert row is None, "Non-participant must not see the session (silent filter)"

    def test_admin_sees_any_session(self, conn):
        creator, admin = uid(), uid()
        insert_user(conn, creator)
        insert_user(conn, admin, user_type="ADMIN")
        sid = insert_tasting_session(conn, creator)

        with as_user(conn, admin):
            row = conn.execute(
                text("SELECT id FROM tasting_sessions WHERE id = :id"), {"id": sid}
            ).fetchone()
        assert row is not None, "Admin must see any tasting session"

    def test_session_list_filters_inaccessible_sessions(self, conn):
        """SELECT * only returns sessions the user is creator or participant of."""
        creator, reader = uid(), uid()
        insert_user(conn, creator)
        insert_user(conn, reader)

        invisible_id = insert_tasting_session(conn, creator)
        own_id = insert_tasting_session(conn, reader)
        joined_id = insert_tasting_session(conn, creator)
        add_participant(conn, joined_id, reader)

        with as_user(conn, reader):
            rows = conn.execute(
                text("SELECT id FROM tasting_sessions WHERE id = ANY(:ids)"),
                {"ids": [invisible_id, own_id, joined_id]},
            ).fetchall()
        visible = {r[0] for r in rows}

        assert invisible_id not in visible, "Session from non-joined session must be filtered"
        assert own_id in visible, "Own session must be visible"
        assert joined_id in visible, "Joined session must be visible"

    def test_non_creator_update_is_silently_blocked(self, conn):
        """UPDATE on a session the user cannot see affects 0 rows."""
        creator, outsider = uid(), uid()
        insert_user(conn, creator)
        insert_user(conn, outsider)
        sid = insert_tasting_session(conn, creator)

        with as_user(conn, outsider):
            result = conn.execute(
                text("UPDATE tasting_sessions SET name = 'Hacked' WHERE id = :id"),
                {"id": sid},
            )
        assert result.rowcount == 0, "Non-creator UPDATE must affect 0 rows"

    def test_creator_can_update_their_session(self, conn):
        creator = uid()
        insert_user(conn, creator)
        sid = insert_tasting_session(conn, creator)

        with as_user(conn, creator):
            result = conn.execute(
                text("UPDATE tasting_sessions SET name = 'Updated' WHERE id = :id"),
                {"id": sid},
            )
        assert result.rowcount == 1, "Creator must be able to update their session"
