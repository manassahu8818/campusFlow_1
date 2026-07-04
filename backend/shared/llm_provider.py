"""
LLM Provider abstraction for CampusFlow.

Single provider: Groq (free tier) for both text and vision.
  - Text:   llama-3.3-70b-versatile
  - Vision: meta-llama/llama-4-scout-17b-16e-instruct (fallback: llama-3.2-90b-vision-preview)

Gemini and Bedrock code paths kept but not default.

Required env vars:
  GROQ_API_KEY — for all LLM calls

Optional env vars:
  LLM_PROVIDER_TEXT   = groq (default) | gemini | bedrock
  LLM_PROVIDER_VISION = groq (default) | gemini | bedrock
  GEMINI_API_KEY      — only if using gemini
"""

from __future__ import annotations

import os
import json
import base64
import logging
import time

logger = logging.getLogger(__name__)

TEXT_PROVIDER = os.environ.get("LLM_PROVIDER_TEXT", "ollama")
VISION_PROVIDER = os.environ.get("LLM_PROVIDER_VISION", "groq")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

GROQ_TEXT_MODEL = "llama-3.3-70b-versatile"
GROQ_VISION_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-11b-vision-preview",
]


# ─── PUBLIC INTERFACE ────────────────────────────────────────────────────────

def call_text_llm(system: str, user: str) -> str:
    """Call a text LLM. Returns assistant response text or empty string on failure."""
    if TEXT_PROVIDER == "ollama":
        return _call_ollama(system, user)
    elif TEXT_PROVIDER == "groq":
        return _call_groq_text(system, user)
    elif TEXT_PROVIDER == "bedrock":
        return _call_bedrock_text(system, user)
    else:
        logger.error(f"Unknown text provider: {TEXT_PROVIDER}")
        return ""


def call_vision_llm(image_bytes: bytes, prompt: str, mime_type: str = "image/png") -> str:
    """Call a vision LLM with image + prompt. Returns response text or empty string."""
    if VISION_PROVIDER == "groq":
        return _call_groq_vision(image_bytes, prompt, mime_type)
    elif VISION_PROVIDER == "gemini":
        return _call_gemini_vision(image_bytes, prompt, mime_type)
    elif VISION_PROVIDER == "bedrock":
        return _call_bedrock_vision(image_bytes, prompt, mime_type)
    else:
        logger.error(f"Unknown vision provider: {VISION_PROVIDER}")
        return ""


# ─── OLLAMA (Local, unlimited, no API key) ───────────────────────────────────

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")

def _call_ollama(system: str, user: str) -> str:
    """Call local Ollama model. Zero rate limits."""
    import urllib.request
    import urllib.error

    url = f"{OLLAMA_URL}/api/chat"
    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.3},
    })

    req = urllib.request.Request(url, data=payload.encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body.get("message", {}).get("content", "")
    except Exception as e:
        logger.error(f"Ollama call failed: {e}")
        # Fallback to Groq if Ollama is down
        if GROQ_API_KEY:
            logger.info("Falling back to Groq...")
            return _call_groq_text(system, user)
        return ""


# ─── GROQ HTTP HELPER (with retry on 429) ───────────────────────────────────

def _groq_request(payload: dict, timeout: int = 60) -> dict:
    """Make a request to Groq API with one retry on 429."""
    import urllib.request
    import urllib.error
    import ssl

    if not GROQ_API_KEY:
        logger.error("GROQ_API_KEY not set")
        return {}

    url = "https://api.groq.com/openai/v1/chat/completions"
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "User-Agent": "CampusFlow/1.0",
    }

    ctx = ssl.create_default_context()

    for attempt in range(3):
        req = urllib.request.Request(url, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            if e.code == 429 and attempt < 2:
                # Parse retry delay if available
                wait = 8 + attempt * 5  # 8s, 13s
                try:
                    err = json.loads(error_body)
                    retry_info = err.get("error", {}).get("message", "")
                    if "retry" in retry_info.lower():
                        import re
                        match = re.search(r"(\d+\.?\d*)\s*s", retry_info)
                        if match:
                            wait = min(float(match.group(1)) + 2, 30)
                except Exception:
                    pass
                logger.warning(f"Groq 429, retrying in {wait}s (attempt {attempt+1})...")
                time.sleep(wait)
                continue
            logger.error(f"Groq API HTTP {e.code}: {error_body[:200]}")
            return {}
        except Exception as e:
            logger.error(f"Groq API call failed: {e}")
            return {}
    return {}


# ─── GROQ TEXT ───────────────────────────────────────────────────────────────

def _call_groq_text(system: str, user: str) -> str:
    """Call Groq with Llama 3.3 70B for text generation."""
    payload = {
        "model": GROQ_TEXT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.3,
        "max_tokens": 8192,
    }
    result = _groq_request(payload, timeout=30)
    if result:
        return result.get("choices", [{}])[0].get("message", {}).get("content", "")
    return ""


# ─── GROQ VISION ─────────────────────────────────────────────────────────────

def _call_groq_vision(image_bytes: bytes, prompt: str, mime_type: str) -> str:
    """Call Groq Vision. Tries multiple vision models in order."""
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    for model in GROQ_VISION_MODELS:
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}"
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            "temperature": 0.2,
            "max_tokens": 4096,
        }

        result = _groq_request(payload, timeout=60)
        if result:
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            if content:
                logger.info(f"Groq vision success with model: {model}")
                return content

        logger.warning(f"Groq vision model {model} failed, trying next...")

    logger.error("All Groq vision models failed")
    return ""


# ─── GEMINI (kept as optional fallback) ──────────────────────────────────────

def _call_gemini_vision(image_bytes: bytes, prompt: str, mime_type: str) -> str:
    """Call Google Gemini 2.0 Flash. Optional — not default."""
    import urllib.request
    import urllib.error
    import ssl

    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not set")
        return ""

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"
    )
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    payload = json.dumps({
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mime_type, "data": image_b64}},
            {"text": prompt},
        ]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096},
    })

    req = urllib.request.Request(url, data=payload.encode("utf-8"),
                                 headers={"Content-Type": "application/json", "User-Agent": "CampusFlow/1.0"})
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        logger.error(f"Gemini API failed: {e}")
        return ""


# ─── BEDROCK (stubbed — flip back when billing resolves) ─────────────────────

def _call_bedrock_text(system: str, user: str) -> str:
    """Call Claude on Bedrock for text. Stubbed until payment resolves."""
    try:
        import boto3
        client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        })
        response = client.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=body, contentType="application/json", accept="application/json",
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"]
    except Exception as e:
        logger.error(f"Bedrock text failed: {e}")
        return ""


def _call_bedrock_vision(image_bytes: bytes, prompt: str, mime_type: str) -> str:
    """Call Claude Vision on Bedrock. Stubbed until payment resolves."""
    try:
        import boto3
        client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
        image_b64 = base64.b64encode(image_bytes).decode("utf-8")
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ]}],
        })
        response = client.invoke_model(
            modelId="anthropic.claude-3-sonnet-20240229-v1:0",
            body=body, contentType="application/json", accept="application/json",
        )
        result = json.loads(response["body"].read())
        return result["content"][0]["text"]
    except Exception as e:
        logger.error(f"Bedrock vision failed: {e}")
        return ""
