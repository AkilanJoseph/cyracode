import os
import uuid
from datetime import datetime, timedelta

import pytest

# Disable rate limiting so tests are not throttled by the 10/min auth limits
os.environ["TESTING"] = "1"
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import app at module level so models are registered with Base.metadata
# before any fixture calls create_all.
from app.main import app  # triggers model registration
from app.database import Base, get_db

# StaticPool keeps a single in-memory connection so all sessions share one DB.
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Override SessionLocal so the LogisticsAuditMiddleware (which calls SessionLocal()
# directly rather than via DI) writes to the same in-memory test database.
import app.database as _app_database
_app_database.SessionLocal = TestingSessionLocal


@pytest.fixture(autouse=True)
def reset_tables():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def _override():
        yield db

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ---------- helpers ----------

def register_user(client, email="user@example.com", password="ValidP@ss1",
                  first_name="Test", last_name="User"):
    return client.post("/auth/register", json={
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "password": password,
        "gdpr_consent": True,
    })


def auth_headers(client, email="user@example.com", password="ValidP@ss1"):
    register_user(client, email=email, password=password)
    resp = client.post("/auth/login", json={"email": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def make_cyracode(db, name, lat=12.9716, lng=77.5946, country_code="IN",
                  is_active=True):
    from app.models.models import CyraCode
    entry = CyraCode(
        id=str(uuid.uuid4()),
        user_id=str(uuid.uuid4()),
        code_name=name,
        code_type="traditional",
        latitude=lat,
        longitude=lng,
        country="India",
        country_code=country_code,
        city="Bangalore",
        street_address="MG Road",
        postal_code="560001",
        is_active=is_active,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def make_verified_otp(db, mobile="+911234567890"):
    """Create a pre-verified OTP record so registration tests bypass the OTP check."""
    from app.models.models import OTPRecord
    record = OTPRecord(
        mobile=mobile,
        otp_hash="test-placeholder-not-verified",
        expires_at=datetime.utcnow() + timedelta(minutes=5),
        is_used=True,
        verified_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    return record


def base_registration_payload(**overrides):
    payload = {
        "name": "MyHome",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "country": "India",
        "country_code": "IN",
        "state": "Karnataka",
        "city": "Bangalore",
        "street_address": "MG Road",
        "postal_code": "560001",
        "verified_mobile": "+911234567890",
    }
    payload.update(overrides)
    return payload
