import os
import uuid
import logging
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

# ---------- Setup ----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
STRIPE_SECRET_KEY = os.environ["STRIPE_SECRET_KEY"]
PREMIUM_AMOUNT_CENTS = int(os.environ.get("STRIPE_PREMIUM_PRICE_AMOUNT", "999"))

stripe_checkout = StripeCheckout(api_key=STRIPE_SECRET_KEY)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("bazi-app")

app = FastAPI(title="BaZi & I Ching Reading API")
api = APIRouter(prefix="/api")


# ---------- Models ----------
class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionReq(BaseModel):
    session_id: str


class BirthProfileCreate(BaseModel):
    name: str
    birth_year: int
    birth_month: int
    birth_day: int
    birth_hour: int
    birth_minute: int
    birthplace: str
    gender: Optional[str] = None


class CheckoutReq(BaseModel):
    origin_url: str


# ---------- Helpers ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "iat": now_utc(), "exp": now_utc() + timedelta(days=14)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def user_public(u: dict) -> dict:
    return {
        "id": u["user_id"],
        "email": u.get("email"),
        "name": u.get("name"),
        "picture": u.get("picture"),
        "is_premium": bool(u.get("is_premium", False)),
        "free_reading_used": bool(u.get("free_reading_used", False)),
    }


async def get_user_by_token(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1].strip()

    # Try JWT first
    user_id: Optional[str] = None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
    except Exception:
        # Treat as session_token (Google auth)
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            raise HTTPException(401, "Invalid token")
        exp = session.get("expires_at")
        if exp and exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp and exp < now_utc():
            raise HTTPException(401, "Session expired")
        user_id = session.get("user_id")

    if not user_id:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    return await get_user_by_token(authorization)


# ---------- Auth Routes ----------
@api.post("/auth/signup")
async def signup(req: SignupReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": req.email.lower(),
        "name": req.name or req.email.split("@")[0],
        "password_hash": hash_password(req.password),
        "is_premium": False,
        "free_reading_used": False,
        "created_at": now_utc(),
        "auth_provider": "email",
    }
    await db.users.insert_one(doc)
    token = make_jwt(user_id)
    return {"token": token, "user": user_public(doc)}


@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_jwt(user["user_id"])
    return {"token": token, "user": user_public(user)}


@api.post("/auth/google/session")
async def google_session(req: GoogleSessionReq):
    """Exchange Emergent OAuth session_id for our session_token."""
    async with httpx.AsyncClient(timeout=15.0) as hc:
        resp = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": req.session_id},
        )
    if resp.status_code != 200:
        raise HTTPException(401, "Invalid Google session")
    data = resp.json()
    email = data.get("email", "").lower()
    name = data.get("name")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(401, "Incomplete session data")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name or email.split("@")[0],
            "picture": picture,
            "is_premium": False,
            "free_reading_used": False,
            "created_at": now_utc(),
            "auth_provider": "google",
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"name": name or user.get("name"), "picture": picture or user.get("picture")}},
        )

    await db.user_sessions.insert_one(
        {
            "session_token": session_token,
            "user_id": user["user_id"],
            "created_at": now_utc(),
            "expires_at": now_utc() + timedelta(days=7),
        }
    )
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"token": session_token, "user": user_public(fresh)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": user_public(user)}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Birth Profiles ----------
@api.post("/birth-profiles")
async def create_profile(req: BirthProfileCreate, user: dict = Depends(current_user)):
    # Free users limit: 1 profile total
    existing_count = await db.birth_profiles.count_documents({"user_id": user["user_id"]})
    if not user.get("is_premium") and existing_count >= 1:
        raise HTTPException(402, "Free users can only have 1 person. Upgrade to Premium.")

    profile_id = f"bp_{uuid.uuid4().hex[:12]}"
    doc = {
        "profile_id": profile_id,
        "user_id": user["user_id"],
        **req.dict(),
        "created_at": now_utc(),
    }
    await db.birth_profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/birth-profiles")
async def list_profiles(user: dict = Depends(current_user)):
    cursor = db.birth_profiles.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(100)


@api.delete("/birth-profiles/{profile_id}")
async def delete_profile(profile_id: str, user: dict = Depends(current_user)):
    res = await db.birth_profiles.delete_one({"profile_id": profile_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Not found")
    await db.readings.delete_many({"birth_profile_id": profile_id})
    return {"ok": True}


# ---------- Reading Generation ----------
READING_PROMPT_TEMPLATE = """You are a thoughtful BaZi (Chinese Four Pillars) and I Ching interpretation assistant. Based on the following birth information, generate a reflective, structured reading. Do not claim certainty or predict unavoidable events. Frame the reading as symbolic, reflective, and for self-awareness.

Birth details:
Name: {name}
Year: {birth_year}
Month: {birth_month}
Day: {birth_day}
Hour: {birth_hour}
Minute: {birth_minute}
Birthplace: {birthplace}
Gender: {gender}

Return the reading in EXACTLY this format using these section headers (each on its own line, prefixed with '## '):

## Overall Energetic Profile
[2-3 paragraphs]

## Five Elements Interpretation
[Discuss Wood, Fire, Earth, Metal, Water balance for this person, 2 paragraphs]

## Personality Pattern
[2 paragraphs]

## Strengths
[Bullet list with 4-6 items, each starting with '- ']

## Growth Challenges
[Bullet list with 3-5 items, framed constructively, each starting with '- ']

## Career and Money Themes
[2 paragraphs]

## Relationship Style
[2 paragraphs]

## Life Phase Themes
[1-2 paragraphs about current and upcoming life phases]

## I Ching Guidance
[Reference one hexagram by name and number that fits the energy, give 1-2 paragraphs of symbolic guidance]

## Practical Reflection Questions
[4-6 thoughtful questions as a bullet list with '- ']

## Disclaimer
This reading is for reflection, self-awareness, and entertainment purposes only. It is not professional, financial, legal, medical, psychological, or life decision advice.

Tone:
Warm, insightful, grounded, respectful, and non-dogmatic. Soften anything negative and always follow with constructive positive framing. Avoid fear-based predictions. Use phrases like "this may suggest", "a possible pattern is", "you may want to reflect on".
"""


@api.post("/readings/generate/{profile_id}")
async def generate_reading(profile_id: str, user: dict = Depends(current_user)):
    profile = await db.birth_profiles.find_one(
        {"profile_id": profile_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not profile:
        raise HTTPException(404, "Birth profile not found")

    # Free user gate: allow only their first reading
    if not user.get("is_premium"):
        existing_readings = await db.readings.count_documents({"user_id": user["user_id"]})
        if existing_readings >= 1:
            raise HTTPException(402, "Free users get 1 reading. Upgrade to Premium for unlimited.")

    prompt = READING_PROMPT_TEMPLATE.format(
        name=profile["name"],
        birth_year=profile["birth_year"],
        birth_month=profile["birth_month"],
        birth_day=profile["birth_day"],
        birth_hour=profile["birth_hour"],
        birth_minute=profile["birth_minute"],
        birthplace=profile["birthplace"],
        gender=profile.get("gender") or "Not specified",
    )

    import asyncio
    last_err = None
    text = None
    for attempt in range(2):
        try:
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"reading_{profile_id}_{attempt}",
                system_message="You are a thoughtful, warm BaZi and I Ching interpretation assistant. Always be reflective and never deterministic.",
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            response = await asyncio.wait_for(
                chat.send_message(UserMessage(text=prompt)), timeout=25
            )
            text = response if isinstance(response, str) else str(response)
            break
        except Exception as e:
            last_err = e
            logger.warning("LLM attempt %s failed: %s", attempt + 1, str(e)[:200])
            if attempt < 1:
                await asyncio.sleep(2)
    if not text:
        raise HTTPException(503, f"Reading service temporarily unavailable. Please try again. ({str(last_err)[:160]})")

    reading_id = f"rd_{uuid.uuid4().hex[:12]}"
    doc = {
        "reading_id": reading_id,
        "user_id": user["user_id"],
        "birth_profile_id": profile_id,
        "reading_type": "bazi_iching",
        "generated_text": text,
        "profile_snapshot": {
            "name": profile["name"],
            "birth_year": profile["birth_year"],
            "birth_month": profile["birth_month"],
            "birth_day": profile["birth_day"],
            "birth_hour": profile["birth_hour"],
            "birth_minute": profile["birth_minute"],
            "birthplace": profile["birthplace"],
        },
        "created_at": now_utc(),
    }
    await db.readings.insert_one(doc)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"free_reading_used": True}})
    doc.pop("_id", None)
    return doc


@api.get("/readings")
async def list_readings(user: dict = Depends(current_user)):
    cursor = db.readings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(100)


@api.get("/readings/{reading_id}")
async def get_reading(reading_id: str, user: dict = Depends(current_user)):
    r = await db.readings.find_one(
        {"reading_id": reading_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not r:
        raise HTTPException(404, "Not found")
    return r


# ---------- Stripe Checkout (Subscription) ----------
@api.post("/stripe/create-checkout-session")
async def create_checkout(req: CheckoutReq, user: dict = Depends(current_user)):
    if user.get("is_premium"):
        raise HTTPException(400, "Already premium")

    origin = req.origin_url.rstrip("/")
    amount_dollars = PREMIUM_AMOUNT_CENTS / 100.0

    try:
        session_resp = await stripe_checkout.create_checkout_session(
            CheckoutSessionRequest(
                amount=amount_dollars,
                currency="usd",
                success_url=f"{origin}/paywall-success?session_id={{CHECKOUT_SESSION_ID}}",
                cancel_url=f"{origin}/paywall?canceled=true",
                metadata={
                    "app_user_id": user["user_id"],
                    "email": user.get("email") or "",
                    "plan": "premium_monthly",
                },
            )
        )
    except Exception as e:
        logger.exception("Stripe error")
        raise HTTPException(400, f"Stripe error: {str(e)[:200]}")

    await db.payment_sessions.insert_one({
        "checkout_session_id": session_resp.session_id,
        "user_id": user["user_id"],
        "status": "pending",
        "amount": PREMIUM_AMOUNT_CENTS,
        "currency": "usd",
        "created_at": now_utc(),
    })
    return {"url": session_resp.url, "session_id": session_resp.session_id}


@api.get("/stripe/session/{session_id}")
async def poll_session(session_id: str, user: dict = Depends(current_user)):
    """Poll session status; if paid, mark user premium."""
    record = await db.payment_sessions.find_one(
        {"checkout_session_id": session_id, "user_id": user["user_id"]}, {"_id": 0}
    )
    if not record:
        raise HTTPException(404, "Session not found")
    # The Emergent stripe proxy retrieves can return 404 for fresh sessions; treat as still pending.
    payment_status = "unpaid"
    status = "open"
    try:
        status_resp = await stripe_checkout.get_checkout_status(session_id)
        payment_status = status_resp.payment_status or payment_status
        status = status_resp.status or status
    except Exception as e:
        msg = str(e)
        logger.info("poll_session: get_status soft-fail for %s: %s", session_id, msg[:200])
        # If we previously marked it paid locally, keep that truth.
        if record.get("status") == "paid":
            payment_status = "paid"
            status = "complete"

    if payment_status == "paid" and record.get("status") != "paid":
        await db.payment_sessions.update_one(
            {"checkout_session_id": session_id},
            {"$set": {"status": "paid", "paid_at": now_utc()}},
        )
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"is_premium": True}},
        )
    return {"payment_status": payment_status, "status": status}


# ---------- Health ----------
@api.get("/")
async def root():
    return {"service": "bazi-iching", "status": "ok"}


# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.birth_profiles.create_index("profile_id", unique=True)
    await db.birth_profiles.create_index("user_id")
    await db.readings.create_index("reading_id", unique=True)
    await db.readings.create_index("user_id")
    logger.info("Startup complete; indexes ensured.")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
