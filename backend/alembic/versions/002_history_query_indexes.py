"""Add indexes for long history and diff queries.

Revision ID: 002_history_query_indexes
Revises: 001_signal_active_realtime
Create Date: 2026-06-01
"""
from alembic import op


revision = "002_history_query_indexes"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_record_device_signal_time",
        "record",
        ["device_id", "signal_name", "captured_at"],
        unique=False,
    )
    op.create_index(
        "ix_device_signal_title_device_name",
        "device_signal",
        ["signal_title", "device_id", "signal_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_device_signal_title_device_name", table_name="device_signal")
    op.drop_index("ix_record_device_signal_time", table_name="record")
