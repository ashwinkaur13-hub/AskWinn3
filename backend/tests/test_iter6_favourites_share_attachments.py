"""Iteration-6 tests: Favourites + Public RFQ share + Chat file attachments.

Seeds users + sessions directly in Mongo per /app/auth_testing.md.
Run:
  pytest /app/backend/tests/test_iter6_favourites_share_attachments.py -v \
    --junitxml=/app/test_reports/pytest/iter6_results.xml
"""
import os
import io
import uuid
import time
import requests
import pytest
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE}/api"
mongo = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
db = mongo[os.environ.get("DB_NAME", "test_database")]

STAMP = int(time.time())


# ---------- Helpers ----------
def _seed_user(role: str, suffix: str = ""):
    uid = f"iter6-{role}-{STAMP}-{uuid.uuid4().hex[:6]}{suffix}"
    tok = f"tok_{uuid.uuid4().hex}"
    email = f"TEST_iter6_{role}_{uid}@example.com"
    db.users.insert_one({
        "user_id": uid, "email": email, "name": f"Iter6 {role}{suffix}",
        "picture": None, "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return uid, tok


def _seed_agent_profile(user_id: str):
    aid = f"agent_iter6_{uuid.uuid4().hex[:10]}"
    db.agent_profiles.insert_one({
        "agent_id": aid, "user_id": user_id, "company_name": "TEST_Iter6 Agent Co",
        "tagline": "", "bio": "", "categories": ["Apparel"], "regions": ["India"],
        "services": [], "min_order_qty": 0, "certifications": [],
        "portfolio_images": [], "verified": False, "rating": 0.0,
        "reviews_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return aid


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def buyer():
    uid, tok = _seed_user("buyer")
    yield {"user_id": uid, "token": tok, "h": {"Authorization": f"Bearer {tok}"}}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})
    db.favourites.delete_many({"user_id": uid})


@pytest.fixture(scope="module")
def buyer2():
    uid, tok = _seed_user("buyer", suffix="-2")
    yield {"user_id": uid, "token": tok, "h": {"Authorization": f"Bearer {tok}"}}
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def agent_user():
    uid, tok = _seed_user("agent")
    aid = _seed_agent_profile(uid)
    yield {"user_id": uid, "token": tok, "agent_id": aid, "h": {"Authorization": f"Bearer {tok}"}}
    db.agent_profiles.delete_one({"agent_id": aid})
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def agent_user2():
    uid, tok = _seed_user("agent", suffix="-b")
    aid = _seed_agent_profile(uid)
    yield {"user_id": uid, "token": tok, "agent_id": aid, "h": {"Authorization": f"Bearer {tok}"}}
    db.agent_profiles.delete_one({"agent_id": aid})
    db.users.delete_one({"user_id": uid})
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def admin_user():
    existing = db.users.find_one({"email": "admin@sourcehq.test"})
    if existing:
        db.users.update_one({"email": "admin@sourcehq.test"}, {"$set": {"role": "admin"}})
        uid = existing["user_id"]
    else:
        uid = f"admin-iter6-{STAMP}"
        db.users.insert_one({
            "user_id": uid, "email": "admin@sourcehq.test", "name": "Admin",
            "picture": None, "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    tok = f"tok_admin_iter6_{uuid.uuid4().hex}"
    db.user_sessions.insert_one({
        "user_id": uid, "session_token": tok,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield {"user_id": uid, "token": tok, "h": {"Authorization": f"Bearer {tok}"}}
    db.user_sessions.delete_one({"session_token": tok})


@pytest.fixture(scope="module")
def buyer_rfq(buyer):
    rid = f"rfq_iter6_{uuid.uuid4().hex[:10]}"
    db.rfqs.insert_one({
        "rfq_id": rid, "buyer_id": buyer["user_id"],
        "title": "TEST_Iter6 RFQ", "description": "iter6 desc",
        "category": "Apparel", "target_region": "India",
        "quantity": 200, "budget_usd": 4000, "timeline": "30 days",
        "status": "open", "winner_quote_id": None,
        "requirements": {}, "attachments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    yield rid
    db.rfqs.delete_one({"rfq_id": rid})


# ===== Favourites =====
class TestFavourites:
    def test_add_favourite_requires_auth(self, agent_user):
        r = requests.post(f"{API}/favourites/{agent_user['agent_id']}")
        assert r.status_code == 401

    def test_agent_cannot_use_favourites(self, agent_user, agent_user2):
        r = requests.post(f"{API}/favourites/{agent_user2['agent_id']}", headers=agent_user["h"])
        assert r.status_code == 403, r.text
        r2 = requests.get(f"{API}/favourites", headers=agent_user["h"])
        assert r2.status_code == 403
        r3 = requests.get(f"{API}/favourites/ids", headers=agent_user["h"])
        assert r3.status_code == 403

    def test_add_favourite_unknown_agent_404(self, buyer):
        r = requests.post(f"{API}/favourites/agent_nope_xxx", headers=buyer["h"])
        assert r.status_code == 404

    def test_add_favourite_idempotent(self, buyer, agent_user):
        r1 = requests.post(f"{API}/favourites/{agent_user['agent_id']}", headers=buyer["h"])
        assert r1.status_code == 200
        assert r1.json().get("favourited") is True
        # second add should still 200, single document
        r2 = requests.post(f"{API}/favourites/{agent_user['agent_id']}", headers=buyer["h"])
        assert r2.status_code == 200
        cnt = db.favourites.count_documents({"user_id": buyer["user_id"], "agent_id": agent_user["agent_id"]})
        assert cnt == 1, f"Expected idempotent fav (1 doc), found {cnt}"

    def test_list_favourites_returns_agent_details(self, buyer, agent_user):
        r = requests.get(f"{API}/favourites", headers=buyer["h"])
        assert r.status_code == 200
        favs = r.json()
        assert isinstance(favs, list) and len(favs) >= 1
        match = next((f for f in favs if f["agent"]["agent_id"] == agent_user["agent_id"]), None)
        assert match is not None, "Favourited agent not in list"
        assert match["agent"]["company_name"] == "TEST_Iter6 Agent Co"
        assert "favourited_at" in match

    def test_favourite_ids_endpoint(self, buyer, agent_user):
        r = requests.get(f"{API}/favourites/ids", headers=buyer["h"])
        assert r.status_code == 200
        data = r.json()
        assert "agent_ids" in data
        assert agent_user["agent_id"] in data["agent_ids"]

    def test_remove_favourite(self, buyer, agent_user):
        r = requests.delete(f"{API}/favourites/{agent_user['agent_id']}", headers=buyer["h"])
        assert r.status_code == 200
        assert r.json().get("favourited") is False
        # GET to verify removal persisted
        r2 = requests.get(f"{API}/favourites/ids", headers=buyer["h"])
        assert agent_user["agent_id"] not in r2.json()["agent_ids"]

    def test_remove_favourite_idempotent(self, buyer, agent_user):
        # Already removed in previous test; second delete still 200
        r = requests.delete(f"{API}/favourites/{agent_user['agent_id']}", headers=buyer["h"])
        assert r.status_code == 200


# ===== Public RFQ share =====
class TestRfqShare:
    def test_create_share_link_owner(self, buyer, buyer_rfq):
        r = requests.post(f"{API}/rfqs/{buyer_rfq}/share", headers=buyer["h"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert "share_token" in data and len(data["share_token"]) > 8
        assert data["share_path"] == f"/p/rfq/{data['share_token']}"
        pytest.iter6_share_token = data["share_token"]

    def test_create_share_link_idempotent(self, buyer, buyer_rfq):
        r = requests.post(f"{API}/rfqs/{buyer_rfq}/share", headers=buyer["h"])
        assert r.status_code == 200
        assert r.json()["share_token"] == pytest.iter6_share_token

    def test_share_non_owner_buyer_forbidden(self, buyer2, buyer_rfq):
        r = requests.post(f"{API}/rfqs/{buyer_rfq}/share", headers=buyer2["h"])
        assert r.status_code == 403

    def test_share_agent_forbidden(self, agent_user, buyer_rfq):
        r = requests.post(f"{API}/rfqs/{buyer_rfq}/share", headers=agent_user["h"])
        assert r.status_code == 403

    def test_share_unknown_rfq_404(self, buyer):
        r = requests.post(f"{API}/rfqs/rfq_does_not_exist/share", headers=buyer["h"])
        assert r.status_code == 404

    def test_public_get_no_auth(self, buyer_rfq):
        tok = pytest.iter6_share_token
        r = requests.get(f"{API}/public/rfqs/{tok}")  # NO auth header
        assert r.status_code == 200, r.text
        data = r.json()
        # Sanitised: no buyer_id, no buyer name, no contact info
        assert "buyer_id" not in data
        assert "buyer_name" not in data
        assert data["rfq_id"] == buyer_rfq
        assert data["title"] == "TEST_Iter6 RFQ"
        assert data["category"] == "Apparel"
        assert "quote_count" in data
        assert "attachment_count" in data

    def test_public_get_invalid_token_404(self):
        r = requests.get(f"{API}/public/rfqs/totally_bogus_token_xxx")
        assert r.status_code == 404

    def test_revoke_share_non_owner_403(self, buyer2, buyer_rfq):
        r = requests.delete(f"{API}/rfqs/{buyer_rfq}/share", headers=buyer2["h"])
        assert r.status_code == 403

    def test_revoke_share_owner(self, buyer, buyer_rfq):
        r = requests.delete(f"{API}/rfqs/{buyer_rfq}/share", headers=buyer["h"])
        assert r.status_code == 200
        # After revoke, public access returns 404
        r2 = requests.get(f"{API}/public/rfqs/{pytest.iter6_share_token}")
        assert r2.status_code == 404


# ===== Chat file attachments =====
class TestMessageAttachments:
    @pytest.fixture(scope="class")
    def small_pdf(self):
        # Minimal PDF magic + filler
        return b"%PDF-1.4\n%TEST iter6 content\n" + b"x" * 256

    def test_upload_unauth_401(self, agent_user, small_pdf):
        files = {"file": ("test.pdf", io.BytesIO(small_pdf), "application/pdf")}
        r = requests.post(f"{API}/messages/attachment",
                          params={"recipient_id": agent_user["user_id"]},
                          files=files)
        assert r.status_code == 401

    def test_upload_unsupported_extension(self, buyer, agent_user):
        files = {"file": ("malware.exe", io.BytesIO(b"MZ\x00\x00"), "application/octet-stream")}
        r = requests.post(f"{API}/messages/attachment",
                          params={"recipient_id": agent_user["user_id"]},
                          headers=buyer["h"], files=files)
        assert r.status_code == 400
        assert "Unsupported" in r.text or "unsupported" in r.text.lower()

    def test_upload_unknown_recipient_404(self, buyer, small_pdf):
        files = {"file": ("ok.pdf", io.BytesIO(small_pdf), "application/pdf")}
        r = requests.post(f"{API}/messages/attachment",
                          params={"recipient_id": "user_nope_zzz"},
                          headers=buyer["h"], files=files)
        assert r.status_code == 404

    def test_upload_file_too_large_400(self, buyer, agent_user):
        big = b"x" * (20 * 1024 * 1024 + 1024)  # > 20 MB
        files = {"file": ("big.pdf", io.BytesIO(big), "application/pdf")}
        r = requests.post(f"{API}/messages/attachment",
                          params={"recipient_id": agent_user["user_id"]},
                          headers=buyer["h"], files=files, timeout=120)
        assert r.status_code == 400
        assert "large" in r.text.lower()

    def test_upload_pdf_ok(self, buyer, agent_user, small_pdf):
        files = {"file": ("attach.pdf", io.BytesIO(small_pdf), "application/pdf")}
        r = requests.post(f"{API}/messages/attachment",
                          params={"recipient_id": agent_user["user_id"]},
                          headers=buyer["h"], files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["filename"] == "attach.pdf"
        assert d["content_type"] == "application/pdf"
        assert "file_id" in d and "storage_path" in d
        assert d["size"] >= len(small_pdf) - 5
        pytest.iter6_attachment = d

    def test_send_message_with_attachment(self, buyer, agent_user):
        att = pytest.iter6_attachment
        payload = {
            "recipient_id": agent_user["user_id"],
            "body": "see attached spec",
            "attachments": [att],
        }
        r = requests.post(f"{API}/messages", json=payload, headers=buyer["h"])
        assert r.status_code == 200, r.text
        msg = r.json()
        assert msg["body"] == "see attached spec"
        assert len(msg["attachments"]) == 1
        assert msg["attachments"][0]["file_id"] == att["file_id"]
        pytest.iter6_message_id = msg["message_id"]

    def test_send_empty_message_400(self, buyer, agent_user):
        payload = {"recipient_id": agent_user["user_id"], "body": "   ", "attachments": []}
        r = requests.post(f"{API}/messages", json=payload, headers=buyer["h"])
        assert r.status_code == 400

    def test_send_message_attachment_only_no_body_ok(self, buyer, agent_user):
        att = pytest.iter6_attachment
        payload = {"recipient_id": agent_user["user_id"], "body": "", "attachments": [att]}
        r = requests.post(f"{API}/messages", json=payload, headers=buyer["h"])
        assert r.status_code == 200

    def test_download_attachment_by_recipient(self, agent_user):
        mid = pytest.iter6_message_id
        fid = pytest.iter6_attachment["file_id"]
        r = requests.get(f"{API}/messages/{mid}/attachment/{fid}",
                         headers=agent_user["h"], timeout=60)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")

    def test_download_attachment_by_sender(self, buyer):
        mid = pytest.iter6_message_id
        fid = pytest.iter6_attachment["file_id"]
        r = requests.get(f"{API}/messages/{mid}/attachment/{fid}",
                         headers=buyer["h"], timeout=60)
        assert r.status_code == 200

    def test_download_attachment_non_participant_403(self, buyer2):
        mid = pytest.iter6_message_id
        fid = pytest.iter6_attachment["file_id"]
        r = requests.get(f"{API}/messages/{mid}/attachment/{fid}",
                         headers=buyer2["h"])
        assert r.status_code == 403

    def test_download_attachment_admin_ok(self, admin_user):
        mid = pytest.iter6_message_id
        fid = pytest.iter6_attachment["file_id"]
        r = requests.get(f"{API}/messages/{mid}/attachment/{fid}",
                         headers=admin_user["h"], timeout=60)
        assert r.status_code == 200

    def test_download_attachment_unauth_401(self):
        mid = pytest.iter6_message_id
        fid = pytest.iter6_attachment["file_id"]
        r = requests.get(f"{API}/messages/{mid}/attachment/{fid}")
        assert r.status_code == 401

    def test_download_unknown_message_404(self, buyer):
        r = requests.get(f"{API}/messages/m_doesnotexist/attachment/none",
                         headers=buyer["h"])
        assert r.status_code == 404

    def test_download_query_token_auth(self, buyer):
        mid = pytest.iter6_message_id
        fid = pytest.iter6_attachment["file_id"]
        tok = buyer["h"]["Authorization"].replace("Bearer ", "")
        r = requests.get(f"{API}/messages/{mid}/attachment/{fid}?auth={tok}",
                         timeout=60)
        assert r.status_code == 200


# ===== Regression spot-checks =====
class TestRegression:
    def test_root(self):
        r = requests.get(f"{API}/")
        assert r.status_code == 200 and r.json().get("ok") is True

    def test_auth_me(self, buyer):
        r = requests.get(f"{API}/auth/me", headers=buyer["h"])
        assert r.status_code == 200
        assert r.json()["role"] == "buyer"

    def test_list_agents(self):
        r = requests.get(f"{API}/agents")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_and_get_rfq(self, buyer):
        payload = {"title": "TEST_Iter6 reg", "description": "reg",
                   "category": "Apparel", "target_region": "India",
                   "quantity": 50, "budget_usd": 1000, "timeline": "15 days"}
        r = requests.post(f"{API}/rfqs", json=payload, headers=buyer["h"])
        assert r.status_code == 200
        rid = r.json()["rfq_id"]
        try:
            r2 = requests.get(f"{API}/rfqs/{rid}", headers=buyer["h"])
            assert r2.status_code == 200
            assert r2.json()["rfq"]["rfq_id"] == rid
        finally:
            db.rfqs.delete_one({"rfq_id": rid})

    def test_quote_submit_and_accept(self, buyer, agent_user):
        # Create RFQ
        payload = {"title": "TEST_Iter6 quote-flow", "description": "x",
                   "category": "Apparel", "target_region": "India",
                   "quantity": 10, "budget_usd": 200, "timeline": "10 days"}
        r = requests.post(f"{API}/rfqs", json=payload, headers=buyer["h"])
        rid = r.json()["rfq_id"]
        try:
            qr = requests.post(
                f"{API}/rfqs/{rid}/quotes",
                json={"price_usd": 180, "lead_time_days": 7, "message": "iter6"},
                headers=agent_user["h"],
            )
            assert qr.status_code == 200, qr.text
            qid = qr.json()["quote_id"]
            ar = requests.post(f"{API}/rfqs/{rid}/accept",
                               json={"quote_id": qid}, headers=buyer["h"])
            assert ar.status_code == 200
            # GET RFQ shows status closed
            g = requests.get(f"{API}/rfqs/{rid}", headers=buyer["h"]).json()
            assert g["rfq"]["status"] == "closed"
        finally:
            db.quotes.delete_many({"rfq_id": rid})
            db.rfqs.delete_one({"rfq_id": rid})

    def test_admin_verify(self, admin_user, agent_user):
        r = requests.post(f"{API}/admin/agents/{agent_user['agent_id']}/verify",
                          headers=admin_user["h"])
        assert r.status_code == 200
        # GET to confirm persistence
        r2 = requests.get(f"{API}/agents/{agent_user['agent_id']}")
        assert r2.json()["agent"]["verified"] is True
        # cleanup: unverify
        requests.post(f"{API}/admin/agents/{agent_user['agent_id']}/unverify",
                      headers=admin_user["h"])
