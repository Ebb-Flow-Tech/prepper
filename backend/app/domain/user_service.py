"""User database service.

Handles all user database operations (get, create, update).
Does NOT interact with Supabase auth.
"""

from datetime import datetime

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import User, UserCreate, UserUpdate


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

    def get_all_users(self) -> list[User]:
        """
        Get all users, ordered by creation date (newest first).

        Returns:
            List of all User objects
        """
        statement = select(User).order_by(User.created_at.desc())
        return list(self.session.exec(statement).all())
