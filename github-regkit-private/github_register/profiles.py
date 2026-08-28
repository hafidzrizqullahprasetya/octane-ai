"""Profile helpers: passwords, GitHub usernames, OTP extraction."""
from __future__ import annotations

import re
import secrets
import string
from typing import Any

_LOWER = string.ascii_lowercase
_UPPER = string.ascii_uppercase
_DIGITS = string.digits
_SYMBOLS = "!@#$%^&*"

_WORDS = [
    "novak", "rava", "kelby", "orin", "zephyr", "marlow", "quill", "sable",
    "tenzin", "fable", "gable", "harlow", "irwin", "jasper", "keaton",
    "landry", "moss", "nolan", "otter", "pascal", "quinn", "rivers", "silas",
    "tobin", "ulric", "vance", "wren", "xander", "yates", "zane",
]

_USERNAME_RE = re.compile(r"^[a-z0-9](?:[a-z0-9]|-(?!-))*[a-z0-9]$")


def generate_password(length: int = 16) -> str:
    """Random password that clears GitHub's strength/blocklist checks."""
    charset = _LOWER + _UPPER + _DIGITS + _SYMBOLS
    while True:
        pw = "".join(secrets.choice(charset) for _ in range(length))
        if (
            any(c in _LOWER for c in pw)
            and any(c in _UPPER for c in pw)
            and any(c in _DIGITS for c in pw)
        ):
            return pw


def generate_username() -> str:
    """GitHub-safe username: [a-z0-9-], no consecutive hyphens, <= 39 chars."""
    suffix = "".join(secrets.choice(_LOWER + _DIGITS) for _ in range(6))
    return f"{secrets.choice(_WORDS)}{suffix}"


_FIRST_NAMES = [
    "arya", "bagas", "citra", "dea", "eka", "fajar", "gita", "hafiz", "irfan",
    "joko", "kartika", "lintang", "maya", "nadia", "okta", "prasetya", "ratna",
    "satria", "tania", "utami", "vian", "wulan", "yoga", "zahra",
    "rendi", "riska", "dian", "bayu", "gilang", "hesti", "intan", "kadek",
    "lisa", "made", "nilam", "rizky", "sinta", "taufik", "usman", "vera",
    "wahyu", "yusuf", "zainal", "agus", "bima", "candra", "dodi", "eko",
]

_LAST_NAMES = [
    "saputra", "maulana", "putri", "wibowo", "nugroho", "ramadhan", "hidayat",
    "kurniawan", "setiawan", "anggraini", "prakoso", "salsabila", "wijaya",
    "pratama", "kusuma", "pamungkas", "firmansyah", "andriani", "laksana",
    "mahendra",
    "siregar", "manurung", "hasibuan", "ginting", "silalahi", "santoso",
    "halim", "suryadi", "iskandar", "efendi", "susanto", "pradana", "lubis",
    "sitompul", "tanjung", "marbun", "nababan", "sinaga", "simanjuntak",
    "tarigan",
]


def generate_human_username() -> str:
    """Human-looking GitHub username without a detectable pattern.

    Repeating one shape (name+name+2 digits) is a bot tell; real usernames are
    messy. Formats are mixed randomly: bare name, name + short number,
    name + year, or hyphenated — with no guarantee any two look alike.
    """
    first = secrets.choice(_FIRST_NAMES)
    last = secrets.choice(_LAST_NAMES)
    roll = secrets.randbelow(10)
    if roll < 3:
        name = f"{first}{last}"
    elif roll < 6:
        name = f"{first}{last}{secrets.randbelow(100)}"
    elif roll < 8:
        name = f"{first}-{last}"
    else:
        name = f"{first}{last}{secrets.choice(range(1985, 2012))}"
    name = name.strip("-").replace("--", "-")
    if not is_valid_username(name):
        name = f"{first}{last}"
    return name if is_valid_username(name) else generate_username()


def username_from_email(email: str, suffix: str = "") -> str:
    """Derive a GitHub username from the mailbox local-part.

    myname123@mail.example.com -> 'myname123'
    Falls back to a random username when the local-part is unusable.
    A short random suffix can be appended when the name is taken.
    """
    local = (email or "").split("@", 1)[0].strip().lower()
    local = re.sub(r"[^a-z0-9-]", "", local)
    local = local.strip("-").replace("--", "-")
    if not is_valid_username(local):
        return generate_username()
    name = (local + suffix)[:39]
    return name if is_valid_username(name) else generate_username()


def is_valid_username(name: str) -> bool:
    return 1 <= len(name) <= 39 and bool(_USERNAME_RE.match(name))


def extract_github_code(text: str) -> str | None:
    """8-digit GitHub code; the email body may separate the halves with a space.

    Also accepts a message that is ONLY a short digit string (4-8 digits) —
    device-verification emails arrive as a bare 6-digit code with no wording.
    """
    if not text:
        return None
    m = re.search(r"\b(\d{4})\s*(\d{4})\b", text)
    if m:
        return m.group(1) + m.group(2)
    for pat in (
        r"verification\s+code[:\s]+(\d{4,8})",
        r"your\s+code[:\s]+(\d{4,8})",
        r"enter\s+this\s+code[:\s]+(\d{4,8})",
    ):
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            return m.group(1)
    if re.fullmatch(r"\s*(\d{4,8})\s*", text or ""):
        return re.sub(r"\s+", "", text).strip()
    return None


def parse_public_profile(random_user: Any, quote: Any) -> dict[str, str]:
    """Extract public display fields from Random User and ZenQuotes payloads.

    Contact details and generated credentials in the Random User response are
    intentionally ignored.
    """
    try:
        user = random_user["results"][0]
        person = user["name"]
        full_name = " ".join(
            part.strip()
            for part in (person.get("title", ""), person["first"], person["last"])
            if part.strip()
        )
        location = str(user["location"]["country"]).strip()
        bio = str(quote[0]["q"]).strip()
    except (IndexError, KeyError, TypeError, AttributeError) as exc:
        raise ValueError(f"invalid public profile payload: {exc}") from exc
    if not full_name or not location or not bio:
        raise ValueError("public profile payload has an empty required field")
    return {"name": full_name, "location": location, "bio": bio}
