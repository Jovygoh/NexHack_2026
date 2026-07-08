"""
Shared multi-provider LLM calling with automatic failover.

Problem this fixes: previously, if OPENAI_API_KEY was set but invalid or
expired, the app would fail that call and drop straight to the offline
rule-based fallback — even when a working GEMINI_API_KEY was also
configured. "Add a Gemini key as backup" silently did nothing, because
OpenAI was hardcoded as the only provider tried per request.

Now: build an ordered provider chain (OpenAI first if configured, then
Gemini), and try providers in order for every LLM call via
call_with_fallback(). Only once every configured provider has failed
does the caller fall through to the offline mode.
"""
from __future__ import annotations

from dataclasses import dataclass

GEMINI_OPENAI_COMPAT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"  # gemini-1.5-flash is retired; 2.5 Flash is on the current free tier


@dataclass
class ProviderConfig:
    name: str  # "openai" or "gemini"
    api_key: str
    model: str
    base_url: str | None = None


def build_provider_chain(
    *,
    openai_api_key: str,
    openai_model: str,
    gemini_api_key: str = "",
    gemini_model: str = "",
) -> list[ProviderConfig]:
    """
    Returns configured providers in priority order. OpenAI is tried
    first (if a key is present), Gemini second — but both are tried,
    instead of Gemini only being used when OpenAI has no key at all.
    """
    providers: list[ProviderConfig] = []
    if openai_api_key:
        providers.append(ProviderConfig(name="openai", api_key=openai_api_key, model=openai_model))
    if gemini_api_key:
        providers.append(
            ProviderConfig(
                name="gemini",
                api_key=gemini_api_key,
                model=gemini_model or DEFAULT_GEMINI_MODEL,
                base_url=GEMINI_OPENAI_COMPAT_BASE_URL,
            )
        )
    return providers


async def call_with_fallback(
    providers: list[ProviderConfig],
    messages: list[dict],
    *,
    temperature: float,
    max_tokens: int | None = None,
    log_prefix: str = "llm",
) -> tuple[str, ProviderConfig]:
    """
    Tries each provider in `providers` order for the SAME prompt, and
    returns (reply_text, provider_used) from the first one that succeeds
    with a non-empty reply. If every provider fails (or none are
    configured), re-raises the last exception so the caller can decide
    how to fall back (e.g. to the offline rule-based mode).
    """
    from openai import AsyncOpenAI  # let ImportError propagate — caller handles it

    if not providers:
        raise RuntimeError("No LLM providers configured (no OpenAI or Gemini API key set).")

    last_exc: Exception | None = None
    for provider in providers:
        try:
            client = (
                AsyncOpenAI(api_key=provider.api_key, base_url=provider.base_url)
                if provider.base_url
                else AsyncOpenAI(api_key=provider.api_key)
            )
            kwargs = {"model": provider.model, "messages": messages, "temperature": temperature}
            if max_tokens is not None:
                kwargs["max_tokens"] = max_tokens
            response = await client.chat.completions.create(**kwargs)
            reply = response.choices[0].message.content
            if reply and reply.strip():
                return reply.strip(), provider
            print(
                f"[{log_prefix}] {provider.name} ({provider.model}) returned an empty response, "
                f"trying next provider if available."
            )
            last_exc = RuntimeError(f"{provider.name} returned an empty response")
        except Exception as exc:
            print(
                f"[{log_prefix}] {provider.name} ({provider.model}) call failed, "
                f"trying next provider if available: {exc!r}"
            )
            last_exc = exc
            continue

    raise last_exc or RuntimeError("All configured LLM providers failed.")
