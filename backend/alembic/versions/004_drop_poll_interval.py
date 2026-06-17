"""Drop poll_interval_seconds column from device table.

Revision ID: 004_drop_poll_interval
Revises: 003_device_time_index
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa


revision = "004_drop_poll_interval"
down_revision = "003_device_time_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("device", "poll_interval_seconds")


def downgrade() -> None:
    op.add_column(
        "device",
        sa.Column(
            "poll_interval_seconds",
            sa.Float(),
            nullable=False,
            server_default="1.0",
        ),
    )
