"""Generic paginated response model."""

import math
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Wrapper for paginated list responses."""

    items: list[T]
    page_number: int
    current_page_size: int
    total_count: int
    total_pages: int

    @classmethod
    def create(
        cls,
        items: list[T],
        total_count: int,
        page_number: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        """Create a PaginatedResponse from items and pagination metadata."""
        return cls(
            items=items,
            page_number=page_number,
            current_page_size=len(items),
            total_count=total_count,
            total_pages=math.ceil(total_count / page_size) if page_size > 0 else 0,
        )
