"""User database service.

Handles all user database operations (get, create, update).
Does NOT interact with Supabase auth.
"""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col, select

from app.models import User, UserCreate, UserUpdate
from app.passport import access


class UserService:
    """Service for user database operations."""

    def __init__(self, session: Session) -> None:
        """Initialize user service with database session."""
        self.session = session

    def get_user(self, user_id: str) -> User | None:
        """
        Get user by ID.

        Args:
            user_id: Supabase user ID

        Returns:
            User object if found, None otherwise
        """
        return self.session.get(User, user_id)

    def get_user_by_email(self, email: str) -> User | None:
        """
        Get user by email.

        Args:
            email: User email address

        Returns:
            User object if found, None otherwise
        """
        statement = select(User).where(User.email == email)
        return self.session.exec(statement).first()

    def create_user(self, data: UserCreate) -> User:
        """
        Create a new user in the database.

        Args:
            data: User creation data including Supabase user ID

        Returns:
            Created user object

        Raises:
            ValueError: If user with this email already exists
        """
        # Check if user already exists
        existing = self.get_user_by_email(data.email)
        if existing:
            raise ValueError(f"User with email {data.email} already exists")

        user = User.model_validate(data)
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def ensure_user(self, user_id: str, email: str, username: str) -> User:
        """Insert-if-absent a local user by email — idempotent, safe to call from a sync handler.

        Returns the existing row if the email is already known (regardless of its id), else creates
        one keyed by `user_id`. Shared by both provisioning paths: interim auto-provisioning (where
        `user_id` is a freshly minted Prepper-Supabase sub) and the SSO login path (where it is the
        Passport-issued sub of a member with no local row yet). Never raises on a race — a concurrent
        insert surfaces as the existing row on re-read.
        """
        existing = self.get_user_by_email(email)
        if existing is not None:
            return existing
        try:
            return self.create_user(UserCreate(id=user_id, email=email, username=username))
        except (ValueError, IntegrityError):
            self.session.rollback()
            found = self.get_user_by_email(email)
            if found is None:
                raise
            return found

    def update_user(self, user_id: str, data: UserUpdate) -> User:
        """
        Update an existing user.

        Args:
            user_id: Supabase user ID
            data: User update data (fields to update)

        Returns:
            Updated user object

        Raises:
            ValueError: If user not found
        """
        user = self.get_user(user_id)
        if not user:
            raise ValueError(f"User with ID {user_id} not found")

        # Update only provided fields
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(user, key, value)

        user.updated_at = datetime.utcnow()
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def _org_scoped_user_query(self, subject: str, organization_id: str):
        """Users who are members of ``organization_id``, newest first.

        `users` has no `organization_id` and must not get one: membership is Passport-owned and
        already projected, and a multi-org user has no single org to store. So the scope is a JOIN:

            users.id = identity_link.subject
            identity_link.platform_user_id = membership.platform_user_id
            membership.organization_id = the ACTING org

        Note the join is on `identity_link.subject` — it holds the local `users.id`, while
        `platform_user_id` holds Passport's. Joining the wrong pair matches nothing and silently
        returns an empty list.

        Scoped to the ACTING org, not the caller's org union. The union was safe against a stranger
        — a non-member never appeared — but someone who genuinely belongs to two orgs saw both
        rosters at once, email and phone included. Two unrelated customers' PII in one response.

        The caller's own membership is still checked first: the acting org must be one of theirs,
        so a forged org id returns nobody rather than that org's roster. `get_org_context` already
        verifies this against the projection; the check is repeated here because this function
        takes the org as an argument, and arguments come from wherever the next caller gets them.

        A user with no identity link appears to nobody — correct, since nothing places them in an
        org, and guessing would be the leak this closes.
        """
        from app.models import PassportIdentityLink, PassportMembership

        platform_user_id = access.platform_user_id_for(self.session, subject)
        if platform_user_id is None:
            return None

        if organization_id not in access.orgs_for_platform_user(self.session, platform_user_id):
            return None

        members_in_my_orgs = (
            select(PassportIdentityLink.subject)
            .join(
                PassportMembership,
                col(PassportMembership.platform_user_id)
                == col(PassportIdentityLink.platform_user_id),
            )
            .where(
                col(PassportMembership.organization_id) == organization_id,
                PassportMembership.status == "active",
            )
        )
        return (
            select(User)
            .where(col(User.id).in_(members_in_my_orgs))
            .order_by(col(User.created_at).desc())
        )

    def get_user_in_org(self, user_id: str, subject: str, organization_id: str) -> User | None:
        """A user by id, but only if they are a member of the acting org.

        `GET /users` was org-scoped in v0.0.67 and `GET /users/{id}` was not, so the roster stopped
        leaking while the individual lookup carried on handing over email, username and phone to
        anyone who could name an id. A by-id read must never be looser than the list it belongs to.

        Reuses `_org_scoped_user_query` rather than restating the join: the two must agree, and the
        way to guarantee that is to have one of them.
        """
        statement = self._org_scoped_user_query(subject, organization_id)
        if statement is None:
            return None
        return self.session.exec(statement.where(User.id == user_id)).first()

    def list_users_paginated(
        self,
        subject: str,
        organization_id: str,
        *,
        offset: int,
        limit: int,
        email: str | None = None,
    ) -> tuple[list[User], int]:
        """Users in the acting org, paginated.

        `subject` and `organization_id` are both REQUIRED. This returned EVERY user in the instance
        — email, username and phone number — to any authenticated caller, unpaginated. `?email=`
        made it a targeted oracle as well as a bulk dump.

        Fails CLOSED: an unresolvable caller, or an org that is not theirs, sees nobody rather than
        everybody.
        """
        statement = self._org_scoped_user_query(subject, organization_id)
        if statement is None:
            return [], 0

        if email:
            statement = statement.where(func.lower(User.email) == email.lower())

        total = self.session.exec(
            select(func.count()).select_from(statement.subquery())
        ).one()
        rows = list(self.session.exec(statement.offset(offset).limit(limit)).all())
        return rows, int(total)

    def list_org_member_accounts(
        self, subject: str, organization_id: str, *, offset: int, limit: int
    ) -> tuple[list[dict[str, object]], int]:
        """The acting org's Passport members, each with their local account if they have one.

        `list_users_paginated` answers "which local `users` rows may I see", and scopes them THROUGH
        the identity link — so it returns only people who have signed in via Passport SSO. On
        staging that is 1 of 20 active members. That scoping is right and is not being loosened; it
        is simply the wrong QUESTION for a roster. The authoritative list of people in an org is
        Passport's membership, which EMBEDS email, display name and role for everyone, signed in or
        not.

        So membership is the spine, and the local account is resolved through the link:

            membership.platform_user_id = identity_link.platform_user_id
            identity_link.subject       = users.id

        Note the pair: `identity_link.subject` holds the LOCAL `users.id` while `platform_user_id`
        holds Passport's. Joining the wrong two matches nothing and silently returns an empty list.

        **Resolved in Python, NOT as a LEFT JOIN — a bug fix, not a preference.** `identity_link` is
        not one-per-person: a platform user can carry several rows for the same app (staging has one
        with two, of which one is orphaned). Joined, they FAN OUT — a row per LINK instead of per
        person — so a member rendered twice, once "Not signed in" and once not, and `count()`
        reported 21 members where 20 exist. `DISTINCT` would not have saved it: the rows genuinely
        differ. The link table is small and per-app, so three flat reads cost less than the join did.

        A RESOLVING link beats an orphan, or a real account reads "Not signed in" purely because a
        stale link happened to sort first.

        `user_id is None` means "never signed in" — no link, so no local row, so no username and no
        phone. They still belong in the list; that is the entire point. Email comes from the
        membership, never the local row: Passport is identity truth, and `users.email` is only ever
        a copy.

        Fails CLOSED, like every read here: an unresolvable caller, or an org that is not theirs,
        sees nobody rather than everybody.
        """
        from app.models import PassportIdentityLink, PassportMembership

        platform_user_id = access.platform_user_id_for(self.session, subject)
        if platform_user_id is None:
            return [], 0

        if organization_id not in access.orgs_for_platform_user(
            self.session, platform_user_id
        ):
            return [], 0

        members = list(
            self.session.exec(
                select(PassportMembership)
                .where(
                    col(PassportMembership.organization_id) == organization_id,
                    PassportMembership.status == "active",
                )
                .order_by(col(PassportMembership.email))
            ).all()
        )
        total = len(members)
        page = members[offset : offset + limit]
        if not page:
            return [], total

        # platform_user_id -> the local account, for THIS page only. A person may carry several
        # links; only one can be their account, and it is the one that resolves to a `users` row.
        wanted = {m.platform_user_id for m in page}
        links = self.session.exec(
            select(PassportIdentityLink).where(
                col(PassportIdentityLink.platform_user_id).in_(wanted)
            )
        ).all()
        users_by_id = {
            u.id: u
            for u in self.session.exec(
                select(User).where(col(User.id).in_({link.subject for link in links}))
            ).all()
        }
        account: dict[str, User] = {}
        for link in links:
            user = users_by_id.get(link.subject)
            if user is not None:
                account.setdefault(link.platform_user_id, user)

        rows: list[dict[str, object]] = []
        for m in page:
            u = account.get(m.platform_user_id)
            rows.append(
                {
                    "platform_user_id": m.platform_user_id,
                    "email": m.email,
                    "display_name": m.display_name,
                    "org_role": m.role,
                    "user_id": u.id if u else None,
                    "username": u.username if u else None,
                    "phone_number": u.phone_number if u else None,
                }
            )
        return rows, total
