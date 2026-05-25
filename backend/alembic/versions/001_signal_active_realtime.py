"""Add active and only_realtime to device_signal

Revision ID: 001
Revises:
Create Date: 2026-05-25
"""
import sqlalchemy as sa
from alembic import op

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "device_signal",
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "device_signal",
        sa.Column("only_realtime", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    # Existing signals were already configured to collect — keep them active.
    op.execute("UPDATE device_signal SET active = true")


def downgrade() -> None:
    op.drop_column("device_signal", "only_realtime")
    op.drop_column("device_signal", "active")
