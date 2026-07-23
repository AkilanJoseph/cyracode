"""Integration tests for /search endpoints."""
from tests.conftest import make_cyracode


class TestAutocomplete:
    def test_prefix_match(self, client, db):
        make_cyracode(db, "AlphaHome")
        make_cyracode(db, "Alpine")
        resp = client.get("/search/autocomplete", params={"q": "Al"})
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert "AlphaHome" in names
        assert "Alpine" in names

    def test_empty_query_returns_empty_list(self, client, db):
        make_cyracode(db, "SomeCode")
        resp = client.get("/search/autocomplete", params={"q": ""})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_no_match_returns_empty(self, client, db):
        make_cyracode(db, "Beta")
        resp = client.get("/search/autocomplete", params={"q": "ZZZ"})
        assert resp.json() == []

    def test_limit_five(self, client, db):
        for i in range(8):
            make_cyracode(db, f"Code{i:02d}")
        resp = client.get("/search/autocomplete", params={"q": "Code"})
        assert len(resp.json()) <= 5


class TestSearchByName:
    def test_found(self, client, db):
        make_cyracode(db, "MyPlace", lat=13.0, lng=77.6)
        resp = client.get("/search/MyPlace")
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "MyPlace"
        assert body["latitude"] == 13.0
        assert body["longitude"] == 77.6
        assert "full_address" in body
        assert "postal_code" in body

    def test_case_insensitive(self, client, db):
        make_cyracode(db, "CamelCase")
        resp = client.get("/search/camelcase")
        assert resp.status_code == 200

    def test_not_found_returns_404_with_suggestions(self, client, db):
        make_cyracode(db, "GammaHouse")
        resp = client.get("/search/GammaHome")
        assert resp.status_code == 404
        detail = resp.json()["detail"]
        assert "message" in detail
        assert isinstance(detail["suggestions"], list)

    def test_completely_unknown_returns_404(self, client):
        resp = client.get("/search/NoSuchCode")
        assert resp.status_code == 404

    def test_inactive_code_not_found(self, client, db):
        make_cyracode(db, "OldCode", is_active=False)
        resp = client.get("/search/OldCode")
        assert resp.status_code == 404


class TestReverseSearch:
    def test_found_within_radius(self, client, db):
        make_cyracode(db, "NearCode", lat=12.9716, lng=77.5946)
        resp = client.post("/search/reverse", json={"lat": 12.97162, "lng": 77.59461})
        assert resp.status_code == 200
        assert resp.json()["name"] == "NearCode"

    def test_not_found_returns_404(self, client, db):
        resp = client.post("/search/reverse", json={"lat": 0.0, "lng": 0.0})
        assert resp.status_code == 404

    def test_returns_nearest(self, client, db):
        make_cyracode(db, "Far", lat=12.9716, lng=77.5946)
        make_cyracode(db, "VeryNear", lat=12.97161, lng=77.59461)
        resp = client.post("/search/reverse", json={"lat": 12.97162, "lng": 77.59462})
        assert resp.json()["name"] == "VeryNear"

    def test_response_shape(self, client, db):
        make_cyracode(db, "ShapeCheck", lat=12.9716, lng=77.5946)
        resp = client.post("/search/reverse", json={"lat": 12.9716, "lng": 77.5946})
        body = resp.json()
        for key in ("name", "code_type", "latitude", "longitude", "full_address", "postal_code"):
            assert key in body
