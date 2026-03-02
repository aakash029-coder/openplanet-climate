"""
climate_engine/db/base.py — ORM Foundation
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import DeclarativeBase, mapped_column


intpk = Annotated[
    int,
    mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
        index=True,
    ),
]

created_at = Annotated[
    datetime,
    mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    ),
]

updated_at = Annotated[
    datetime,
    mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    ),
]


class Base(DeclarativeBase):
    """
    Central ORM base. All models inherit from this.
    Provides shared metadata registry (Alembic + create_all).
    """

    type_annotation_map: dict = {}

    def __repr__(self) -> str:
        pk_cols = [col.key for col in self.__mapper__.primary_key]
        pk_vals = {col: getattr(self, col, "?") for col in pk_cols}
        pk_str = ", ".join(f"{k}={v!r}" for k, v in pk_vals.items())
        return f"<{self.__class__.__name__}({pk_str})>"