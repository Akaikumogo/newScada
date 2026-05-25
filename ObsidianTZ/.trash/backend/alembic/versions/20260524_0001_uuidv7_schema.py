"""uuidv7 schema

Revision ID: 20260524_0001
Revises:
Create Date: 2026-05-24 04:58:00
"""
import sqlalchemy as sa

from alembic import op

revision = "20260524_0001"
down_revision = None
branch_labels = None
depends_on = None


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "branch",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        *timestamp_columns(),
    )
    op.create_index("ix_branch_name", "branch", ["name"])
    op.create_index("ix_branch_type", "branch", ["type"])

    op.create_table(
        "device_model",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("manufacturer", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.UniqueConstraint("name", "manufacturer", name="uq_device_model_name_mfg"),
    )
    op.create_index("ix_device_model_name", "device_model", ["name"])
    op.create_index("ix_device_model_manufacturer", "device_model", ["manufacturer"])

    op.create_table(
        "substation",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("branch_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("address", sa.String(length=200), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["branch_id"], ["branch.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_substation_branch_id", "substation", ["branch_id"])
    op.create_index("ix_substation_name", "substation", ["name"])

    op.create_table(
        "device",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("substation_id", sa.Uuid(), nullable=False),
        sa.Column("model_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("protocol", sa.String(length=32), nullable=False),
        sa.Column("iec104_host", sa.String(length=64), nullable=False),
        sa.Column("iec104_port", sa.Integer(), nullable=False),
        sa.Column("iec104_common_address", sa.Integer(), nullable=False),
        sa.Column("poll_interval_seconds", sa.Float(), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["model_id"], ["device_model.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["substation_id"], ["substation.id"], ondelete="RESTRICT"),
    )
    op.create_index("ix_device_model_id", "device", ["model_id"])
    op.create_index("ix_device_name", "device", ["name"])
    op.create_index("ix_device_protocol", "device", ["protocol"])
    op.create_index("ix_device_substation_id", "device", ["substation_id"])

    op.create_table(
        "device_signal",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("register_code", sa.Integer(), nullable=False),
        sa.Column("signal_name", sa.String(length=64), nullable=False),
        sa.Column("signal_title", sa.String(length=160), nullable=True),
        sa.Column("unit", sa.String(length=24), nullable=False),
        sa.Column("value_type", sa.String(length=32), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["device_id"], ["device.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("device_id", "register_code", name="uq_signal_device_ioa"),
    )
    op.create_index("ix_device_signal_device_id", "device_signal", ["device_id"])
    op.create_index("ix_device_signal_register_code", "device_signal", ["register_code"])
    op.create_index("ix_device_signal_signal_name", "device_signal", ["signal_name"])
    op.create_index("ix_device_signal_unit", "device_signal", ["unit"])
    op.create_index("ix_device_signal_value_type", "device_signal", ["value_type"])

    op.create_table(
        "substation_schema",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("substation_id", sa.Uuid(), nullable=False, unique=True),
        sa.Column("canvas_json", sa.JSON(), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["substation_id"], ["substation.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_substation_schema_substation_id", "substation_schema", ["substation_id"])

    op.create_table(
        "record",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("signal_name", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("quality", sa.SmallInteger(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["device_id"], ["device.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_record_device_id", "record", ["device_id"])
    op.create_index("ix_record_signal_name", "record", ["signal_name"])
    op.create_index("idx_record_captured_at", "record", ["captured_at"])
    op.create_index(
        "idx_record_device_signal_time",
        "record",
        ["device_id", "signal_name", "captured_at"],
    )


def downgrade() -> None:
    op.drop_index("idx_record_device_signal_time", table_name="record")
    op.drop_index("idx_record_captured_at", table_name="record")
    op.drop_index("ix_record_signal_name", table_name="record")
    op.drop_index("ix_record_device_id", table_name="record")
    op.drop_table("record")
    op.drop_index("ix_substation_schema_substation_id", table_name="substation_schema")
    op.drop_table("substation_schema")
    op.drop_index("ix_device_signal_value_type", table_name="device_signal")
    op.drop_index("ix_device_signal_unit", table_name="device_signal")
    op.drop_index("ix_device_signal_signal_name", table_name="device_signal")
    op.drop_index("ix_device_signal_register_code", table_name="device_signal")
    op.drop_index("ix_device_signal_device_id", table_name="device_signal")
    op.drop_table("device_signal")
    op.drop_index("ix_device_substation_id", table_name="device")
    op.drop_index("ix_device_protocol", table_name="device")
    op.drop_index("ix_device_name", table_name="device")
    op.drop_index("ix_device_model_id", table_name="device")
    op.drop_table("device")
    op.drop_index("ix_substation_name", table_name="substation")
    op.drop_index("ix_substation_branch_id", table_name="substation")
    op.drop_table("substation")
    op.drop_index("ix_device_model_manufacturer", table_name="device_model")
    op.drop_index("ix_device_model_name", table_name="device_model")
    op.drop_table("device_model")
    op.drop_index("ix_branch_type", table_name="branch")
    op.drop_index("ix_branch_name", table_name="branch")
    op.drop_table("branch")
