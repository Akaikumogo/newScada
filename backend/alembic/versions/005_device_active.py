"""Add active column to device table.

Revision ID: 005_device_active
Revises: 004_drop_poll_interval
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa


revision = "005_device_active"
down_revision = "004_drop_poll_interval"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "device",
        sa.Column(
            "active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )


def downgrade() -> None:
    op.drop_column("device", "active")
