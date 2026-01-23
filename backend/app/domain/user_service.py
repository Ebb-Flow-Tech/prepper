"""User database service.

Handles all user database operations (get, create, update).
Does NOT interact with Supabase auth.
"""

from datetime import datetime

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
