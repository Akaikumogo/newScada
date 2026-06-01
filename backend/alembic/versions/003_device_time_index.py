"""Add (device_id, captured_at) index for device-activity queries.

Revision ID: 003_device_time_index
Revises: 002_history_query_indexes
Create Date: 2026-06-01
"""
from alembic import op


revision = "003_device_time_index"
down_revision = "002_history_query_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_record_device_time",
        "record",
        ["device_id", "captured_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_record_device_time", table_name="record")
