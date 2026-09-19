import base64
import io
import math
import random
import string
import unicodedata
from datetime import datetime

import httpx
import qrcode
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.models import CyraCode, User

# Themed vocabulary used to build personalized CyraCode name suggestions. Each
# key is the display label (emoji + category) returned with the suggestion; the
# values are lowercase theme words combined with the user's own name details so
# every generated name stays unique and memorable.
THEMED_WORDS = {
    "🌿 Nature": ["willow", "fern", "grove", "meadow", "breeze", "vale", "clover", "dune", "moss", "field"],
    "🌸 Flowers": ["bloom", "lily", "rose", "lotus", "daisy", "tulip", "iris", "jasmine", "marigold", "peony"],
    "🐦 Birds": ["falcon", "eagle", "sparrow", "raven", "swift", "heron", "robin", "hawk", "owl", "kite"],
    "🦋 Animals": ["puma", "lynx", "leopard", "tiger", "bison", "viper", "panda", "koala", "wolf", "otter"],
    "🌳 Trees": ["oak", "cedar", "elm", "pine", "maple", "birch", "aspen", "yew", "rowan", "tamar"],
    "🌊 Ocean": ["coral", "reef", "tide", "wave", "current", "bay", "lagoon", "atoll", "harbour", "delta"],
    "🌌 Space": ["orion", "vega", "comet", "nova", "quasar", "nebula", "star", "galaxy", "aster", "pulsar"],
    "🪐 Planets": ["terra", "mars", "venus", "saturn", "neptune", "jupiter", "mercury", "pluto", "uranus", "eris"],
    "✨ Fantasy": ["dragon", "griffin", "titan", "mystic", "rune", "enchant", "legend", "mage", "glade", "elixir"],
    "🔮 Mythical": ["phoenix", "hydra", "sphinx", "pegasus", "unicorn", "gryphon", "chimera", "basilisk", "kraken", "griffin"],
    "💎 Gemstones": ["jade", "onyx", "topaz", "ruby", "opal", "amber", "emerald", "sapphire", "quartz", "garnet"],
    "🔥 Elements": ["ember", "blaze", "flare", "storm", "thunder", "frost", "quake", "gale", "volt", "flame"],
    "🌈 Colors": ["crimson", "indigo", "scarlet", "azure", "cobalt", "ochre", "sable", "jade", "amber", "purple"],
    "☀️ Sky": ["sunny", "zephyr", "aurora", "mist", "halo", "rain", "sky", "nimbus", "sol", "dusk"],
    "🚀 Futuristic": ["orbit", "circuit", "quantum", "vector", "pixel", "cyber", "neo", "byte", "nexus", "sonic"],
    "🌙 Cosmic": ["cosmo", "zenith", "eclipse", "astra", "lunar", "solar", "stellar", "void", "crescent", "aurora"],
}


def haversine_distance(lat1, lng1, lat2, lng2) -> float:
    """Return distance in meters between two coordinate pairs."""
    r = 6371000.0
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    dphi = math.radians(float(lat2) - float(lat1))
    dlambda = math.radians(float(lng2) - float(lng1))
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def check_name_available(db: Session, name: str) -> bool:
    existing = (
        db.query(CyraCode)
        .filter(func.lower(CyraCode.code_name) == name.lower())
        .first()
    )
    return existing is None


def count_active_cyracodes(db: Session) -> int:
    """Return the number of currently registered (active) CyraCodes.

    Only rows that were persisted by a successfully completed registration are
    counted, so failed, cancelled, or duplicate registrations never inflate the
    total. The count is derived live from committed rows, which keeps it
    identical across users, devices, sessions, and application instances and
    immune to concurrent-registration races.

    An explicit ``func.count`` on the primary key is used (rather than the
    legacy ORM ``Query.count()``) so the query never selects columns the table
    may be missing in a pre-existing dev database, and it stays cheap at scale.
    """
    return (
        db.query(func.count(CyraCode.id))
        .filter(CyraCode.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )


def suggest_alternative_names(db: Session, name: str) -> list:
    suggestions = []
    candidates = []
    suffixes = ["1", "01", "X", "Home", "HQ", str(random.randint(10, 99))]
    for suffix in suffixes:
        candidates.append(f"{name}{suffix}")
    candidates.append(f"{name}_{random.randint(100, 999)}")
    candidates.append(f"The{name}")

    for candidate in candidates:
        if len(suggestions) >= 5:
            break
        if check_name_available(db, candidate):
            suggestions.append(candidate)

    return suggestions[:5] if suggestions else [f"{name}{random.randint(1000, 9999)}"]


# ---------- Personalized name suggestions ----------

# Display label used for names built purely from the user's own profile details.
PERSONAL_LABEL = "🌟 Personalized"


def _normalize_user_part(value: str) -> str:
    """Keep only letters and digits from a profile field (preserves Unicode)."""
    return "".join(ch for ch in (value or "") if ch.isalnum())


def _title_word(value: str) -> str:
    if not value:
        return ""
    return value[0].upper() + value[1:].lower()


def _is_valid_name_candidate(name: str) -> bool:
    """A suggestion must satisfy the CyraCode naming rules: 3–50 characters,
    Unicode letters, digits, and spaces only."""
    if not name or not 3 <= len(name) <= 50:
        return False
    return all(
        unicodedata.category(ch).startswith(("L", "N")) or ch == " " for ch in name
    )


def _user_parts(user: User) -> dict:
    """Derive the name building blocks from a user's non-sensitive profile fields.

    Uses first name, last name, and initials; the email prefix acts as a
    username-like fallback when no usable name parts exist.
    """
    first = _normalize_user_part(user.first_name)
    last = _normalize_user_part(user.last_name)
    email_prefix = _normalize_user_part((user.email or "").split("@")[0])

    primary = _title_word(first)
    secondary = _title_word(last) if last else ""
    initials = ""
    if first:
        initials = first[0].upper()
    if last:
        initials += last[0].upper()

    if not primary and email_prefix:
        primary = _title_word(email_prefix)

    return {"primary": primary, "secondary": secondary, "initials": initials}


def _build_candidate_groups(parts: dict) -> list:
    """Build three varied groups of candidate suggestions.

    * name-based  — built purely from the user's own details
    * themed      — the user's details combined with a multi-category vocabulary
    * creative    — fully themed names drawn from the vocabulary, category by category
    """
    name_based = []
    themed = []
    creative = []
    seen = set()

    def add(group, name, label):
        name = name.strip()
        if not name or name in seen or not _is_valid_name_candidate(name):
            return
        seen.add(name)
        group.append({"name": name, "category": label})

    primary = parts["primary"]
    secondary = parts["secondary"]
    initials = parts["initials"]

    # 1) Name-based variants from the user's own profile details.
    if primary:
        add(name_based, primary, PERSONAL_LABEL)
        if secondary:
            add(name_based, primary + secondary, PERSONAL_LABEL)
        if initials and len(initials) >= 2:
            add(name_based, primary + initials, PERSONAL_LABEL)

    # 2) Mix the user's details with themed words (suffix + inverted/initials
    #    styles) so the batch spans many categories.
    labels = list(THEMED_WORDS.keys())
    random.shuffle(labels)
    for label in labels:
        words = list(THEMED_WORDS[label])
        random.shuffle(words)
        word = _title_word(words[0])
        if primary:
            add(themed, primary + word, label)
            add(themed, word + primary, label)
            if secondary:
                add(themed, secondary + word, label)
            if initials and len(initials) >= 2:
                add(themed, initials + word, label)
        else:
            add(themed, word, label)

    # 3) Fully themed (creative) names, one per category, so a batch is never
    #    100% dependent on the user's own name.
    for label in labels:
        words = list(THEMED_WORDS[label])
        random.shuffle(words)
        add(creative, _title_word(words[0]), label)

    return [name_based, themed, creative]


def _interleave(groups: list) -> list:
    """Round-robin merge so consecutive suggestions come from different groups,
    guaranteeing the shown batch mixes patterns (name-based, themed, creative)."""
    result = []
    pointers = [0] * len(groups)
    while True:
        advanced = False
        for i, group in enumerate(groups):
            if pointers[i] < len(group):
                result.append(group[pointers[i]])
                pointers[i] += 1
                advanced = True
        if not advanced:
            break
    return result


def generate_personalized_suggestions(user: User, db: Session, limit: int = 10) -> list:
    """Return up to ``limit`` available, unique, personalized name suggestions.

    Candidates are built by combining the logged-in user's own profile details
    with a curated multi-category vocabulary, then run through the database
    availability check so only names that are not already registered
    (case-insensitive) are ever returned. Unavailable candidates are skipped and
    generation continues until the target count is reached or the pool runs out.
    """
    groups = _build_candidate_groups(_user_parts(user))
    candidates = _interleave(groups)
    suggestions = []
    for candidate in candidates:
        if len(suggestions) >= limit:
            break
        if check_name_available(db, candidate["name"]):
            suggestions.append(candidate)
    return suggestions


def generate_cyracode(lat: float, lng: float, db: Session) -> str:
    """Generate a 12-char code in format: LL#LL##L##L# (L=letter, #=digit).
    Example: Aa2DF43T91q5
    """
    L = string.ascii_letters
    D = string.digits
    for _ in range(10):
        code = (
            "".join(random.choices(L, k=2))
            + "".join(random.choices(D, k=1))
            + "".join(random.choices(L, k=2))
            + "".join(random.choices(D, k=2))
            + "".join(random.choices(L, k=1))
            + "".join(random.choices(D, k=2))
            + "".join(random.choices(L, k=1))
            + "".join(random.choices(D, k=1))
        )
        if check_name_available(db, code):
            return code
    return code


def validate_coordinates_not_ocean(lat: float, lng: float) -> bool:
    """AC 6.18: Server-side check — return False if coordinates map to ocean/uninhabited land.

    Uses Google Maps Geocoding API when a key is configured; fails open (returns True)
    if no key is set or if the API call fails, so the client-side Google Maps check
    remains the primary gate for ocean/uninhabited detection.
    """
    if not settings.GOOGLE_MAPS_API_KEY:
        return True
    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "latlng": f"{float(lat)},{float(lng)}",
                "key": settings.GOOGLE_MAPS_API_KEY,
                "result_type": "street_address|route|locality|sublocality",
            },
            timeout=5.0,
        )
        if resp.status_code != 200:
            return True  # fail-open on API error
        data = resp.json()
        if data.get("status") == "ZERO_RESULTS":
            return False
        return bool(data.get("results"))
    except Exception:
        return True  # fail-open on network error


def validate_coordinates(lat: float, lng: float) -> bool:
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180


def create_cyracode_entry(db: Session, user_id: str, data: dict) -> CyraCode:
    entry = CyraCode(
        user_id=user_id,
        code_name=data["code_name"],
        code_type=data["code_type"],
        latitude=data["latitude"],
        longitude=data["longitude"],
        country=data["country"],
        country_code=data["country_code"],
        state=data.get("state"),
        district=data.get("district"),
        city=data.get("city"),
        area=data.get("area"),
        town=data.get("town"),
        road_name=data.get("road_name"),
        avenue_name=data.get("avenue_name"),
        street_address=data["street_address"],
        building_name=data.get("building_name"),
        flat_number=data.get("flat_number"),
        suite_name=data.get("suite_name"),
        plot_number=data.get("plot_number"),
        floor_unit=data.get("floor_unit"),
        postal_code=data["postal_code"],
        po_box=data.get("po_box"),
        landmark=data.get("landmark"),
        qr_code_path=data.get("qr_code_path"),
        is_flagged=data.get("is_flagged", False),
        flag_reason=data.get("flag_reason"),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_cyracode_entry(db: Session, entry: CyraCode, data: dict) -> CyraCode:
    """Update the editable address fields of an existing CyraCode.

    ``code_name`` is intentionally never touched — it is unique and immutable.
    """
    entry.latitude = data["latitude"]
    entry.longitude = data["longitude"]
    entry.country = data["country"]
    entry.country_code = data["country_code"]
    entry.state = data.get("state")
    entry.district = data.get("district")
    entry.city = data.get("city")
    entry.area = data.get("area")
    entry.town = data.get("town")
    entry.road_name = data.get("road_name")
    entry.avenue_name = data.get("avenue_name")
    entry.street_address = data["street_address"]
    entry.building_name = data.get("building_name")
    entry.flat_number = data.get("flat_number")
    entry.suite_name = data.get("suite_name")
    entry.plot_number = data.get("plot_number")
    entry.floor_unit = data.get("floor_unit")
    entry.postal_code = data["postal_code"]
    entry.po_box = data.get("po_box")
    entry.landmark = data.get("landmark")
    entry.updated_at = datetime.utcnow()
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def deactivate_cyracode_entry(db: Session, entry: CyraCode) -> CyraCode:
    """Soft-delete a CyraCode so it no longer appears in searches or "my codes".

    The row is kept (``is_active=False``) so the unique ``code_name`` cannot be
    re-registered by someone else and any historical references are preserved.
    """
    entry.is_active = False
    entry.updated_at = datetime.utcnow()
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def generate_qr_code(cyracode_name: str, lat: float, lng: float) -> str:
    """Generate a QR code and return it as a base64 data URI.

    AC 6.10: WebP is used where Pillow supports it (<100 KB); falls back to PNG.
    """
    payload = f"CYRACODE:{cyracode_name}|{lat},{lng}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#FF6B35", back_color="white")
    # Convert to RGB so WebP encoder handles it correctly
    rgb_img = img.convert("RGB")
    buffer = io.BytesIO()
    try:
        rgb_img.save(buffer, format="WEBP", quality=85, method=4)
        mime = "image/webp"
    except Exception:
        buffer = io.BytesIO()
        rgb_img.save(buffer, format="PNG")
        mime = "image/png"
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"
