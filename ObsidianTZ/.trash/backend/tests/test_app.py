from uuid import UUID

from fastapi.testclient import TestClient

from app.core.ids import uuid7
from app.main import app

client = TestClient(app)


def test_uuid7_generation() -> None:
    value = uuid7()
    assert isinstance(value, UUID)
    assert value.version == 7
    assert value.variant == "specified in RFC 4122"


def test_health_endpoint_uses_project_name() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["app"] == "TEST127"


def test_openapi_has_resource_list_and_get_by_id_paths() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]

    expected_paths = [
        "/api/branches",
        "/api/branches/{branch_id}",
        "/api/substations",
        "/api/substations/{substation_id}",
        "/api/models",
        "/api/models/{model_id}",
        "/api/devices",
        "/api/devices/{device_id}",
        "/api/signals",
        "/api/signals/{signal_id}",
        "/api/schemas",
        "/api/schemas/{schema_id}",
        "/api/records",
        "/api/records/{record_id}",
    ]
    for path in expected_paths:
        assert path in paths


def test_list_endpoints_expose_pagination_search_and_sort_params() -> None:
    schema = client.get("/openapi.json").json()
    parameters = schema["paths"]["/api/branches"]["get"]["parameters"]
    names = {parameter["name"] for parameter in parameters}
    assert {"page", "page_size", "search", "sort_by", "sort_order"}.issubset(names)
