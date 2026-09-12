"""Integration tests for /search endpoints.

Search is restricted to the authenticated user's own CyraCodes, so every test
creates a logged-in user and owns codes via that user.
"""
from tests.conftest import auth_headers, make_cyracode

from app.models.models import User


def authed_headers_and_user(client, db, email="user@example.com"):
    headers = auth_headers(client, email=email)
    user = db.query(User).filter(User.email == email).first()
    return headers, user.id


class TestSearchAuth:
    def test_autocomplete_requires_login(self, client, db):
        make_cyracode(db, "AlphaHome")
        resp = client.get("/search/autocomplete", params={"q": "Al"})
        assert resp.status_code == 401

    def test_search_requires_login(self, client, db):
        make_cyracode(db, "AlphaHome")
        resp = client.get("/search/AlphaHome")
        assert resp.status_code == 401

    def test_reverse_requires_login(self, client, db):
        make_cyracode(db, "AlphaHome")
        resp = client.post("/search/reverse", json={"lat": 12.9716, "lng": 77.5946})
        assert resp.status_code == 401


class TestAutocomplete:
    def test_prefix_match(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "AlphaHome", user_id=uid)
        make_cyracode(db, "Alpine", user_id=uid)
        resp = client.get("/search/autocomplete", params={"q": "Al"}, headers=headers)
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert "AlphaHome" in names
        assert "Alpine" in names

    def test_empty_query_returns_empty_list(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "SomeCode", user_id=uid)
        resp = client.get("/search/autocomplete", params={"q": ""}, headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_no_match_returns_empty(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "Beta", user_id=uid)
        resp = client.get("/search/autocomplete", params={"q": "ZZZ"}, headers=headers)
        assert resp.json() == []

    def test_limit_five(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        for i in range(8):
            make_cyracode(db, f"Code{i:02d}", user_id=uid)
        resp = client.get("/search/autocomplete", params={"q": "Code"}, headers=headers)
        assert len(resp.json()) <= 5

    def test_does_not_show_other_users_codes(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "AlphaHome", user_id=uid)
        # Another user's code must never appear in autocomplete
        make_cyracode(db, "Alpine")
        resp = client.get("/search/autocomplete", params={"q": "Al"}, headers=headers)
        names = [r["name"] for r in resp.json()]
        assert "AlphaHome" in names
        assert "Alpine" not in names


class TestSearchByName:
    def test_found(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "MyPlace", lat=13.0, lng=77.6, user_id=uid)
        resp = client.get("/search/MyPlace", headers=headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "MyPlace"
        assert body["latitude"] == 13.0
        assert body["longitude"] == 77.6
        assert "full_address" in body
        assert "postal_code" in body

    def test_case_insensitive(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "CamelCase", user_id=uid)
        resp = client.get("/search/camelcase", headers=headers)
        assert resp.status_code == 200

    def test_does_not_find_another_users_code(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "PrivatePlace", user_id=uid)
        make_cyracode(db, "OtherUsersCode")
        resp = client.get("/search/PrivatePlace", headers=headers)
        assert resp.status_code == 200
        resp = client.get("/search/OtherUsersCode", headers=headers)
        assert resp.status_code == 404

    def test_not_found_returns_404_with_suggestions(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "GammaHouse", user_id=uid)
        resp = client.get("/search/GammaHome", headers=headers)
        assert resp.status_code == 404
        detail = resp.json()["detail"]
        assert "message" in detail
        assert isinstance(detail["suggestions"], list)

    def test_completely_unknown_returns_404(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        resp = client.get("/search/NoSuchCode", headers=headers)
        assert resp.status_code == 404

    def test_inactive_code_not_found(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "OldCode", is_active=False, user_id=uid)
        resp = client.get("/search/OldCode", headers=headers)
        assert resp.status_code == 404


class TestReverseSearch:
    def test_found_within_radius(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "NearCode", lat=12.9716, lng=77.5946, user_id=uid)
        resp = client.post("/search/reverse", json={"lat": 12.97162, "lng": 77.59461}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "NearCode"

    def test_not_found_returns_404(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        resp = client.post("/search/reverse", json={"lat": 0.0, "lng": 0.0}, headers=headers)
        assert resp.status_code == 404

    def test_returns_nearest(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "Far", lat=12.9716, lng=77.5946, user_id=uid)
        make_cyracode(db, "VeryNear", lat=12.97161, lng=77.59461, user_id=uid)
        resp = client.post("/search/reverse", json={"lat": 12.97162, "lng": 77.59462}, headers=headers)
        assert resp.json()["name"] == "VeryNear"

    def test_does_not_return_other_users_code(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        # "Theirs" is within 50 m of the query point but owned by someone else —
        # it must be filtered out, yielding 404.
        make_cyracode(db, "Theirs", lat=12.97161, lng=77.59461)
        resp = client.post("/search/reverse", json={"lat": 12.97162, "lng": 77.59462}, headers=headers)
        assert resp.status_code == 404

    def test_response_shape(self, client, db):
        headers, uid = authed_headers_and_user(client, db)
        make_cyracode(db, "ShapeCheck", lat=12.9716, lng=77.5946, user_id=uid)
        resp = client.post("/search/reverse", json={"lat": 12.9716, "lng": 77.5946}, headers=headers)
        body = resp.json()
        for key in ("name", "code_type", "latitude", "longitude", "full_address", "postal_code"):
            assert key in body