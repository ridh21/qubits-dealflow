"""Configuration for the read-only DealFlow360 assistant.

Every value comes from the environment. In development the repo-root `.env` is
loaded directly (`uv run --env-file ../../.env`); in Compose the same file is
passed as `env_file` and container-specific hosts are overridden there.
"""

from urllib.parse import urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Database ────────────────────────────────────────────────────────────
    # The assistant connects as a SELECT-only Postgres role, never as the
    # application role. See prisma/sql/readonly-role.sql. Falling back to
    # DATABASE_URL keeps a first run working, but the role is the real guard.
    assistant_database_url: str = ""
    database_url: str = "postgresql://dealflow:dealflow_dev@127.0.0.1:55432/dealflow_dev"

    # ── LLM (any OpenAI-compatible endpoint) ────────────────────────────────
    llm_base_url: str = "https://chat-api.hetsaraiya.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gpt-5.5"
    # This gateway fronts several upstream providers, and a model stops working
    # the moment its provider's daily quota is spent — sometimes while still
    # advertised in /v1/models. Requests fall back down this list on 429/503, so
    # one exhausted provider degrades the answer instead of breaking it.
    llm_fallback_models: str = "gpt-5.4-mini,xai/grok-4.6,opencode-go/deepseek-v4-flash"
    # A short per-attempt timeout with few retries fails in ~40s total rather
    # than hanging past the browser's 45s abort.
    llm_timeout: int = 20
    llm_max_retries: int = 2

    # ── Service ─────────────────────────────────────────────────────────────
    # Shared secret the Next.js proxy sends as `x-assistant-key`. The agent is
    # bound to localhost in Compose, but this stops anything else on the host
    # from talking to it directly.
    assistant_service_key: str = ""
    # Hard ceiling on rows returned to the model, so a careless SELECT cannot
    # pull the whole table into the prompt. Prefixed because the repo-root .env
    # is shared with the Next.js app, which has its own MAX_* variables.
    assistant_max_result_rows: int = 30

    @property
    def llm_candidates(self) -> list[str]:
        """Preferred model first, then the fallbacks, de-duplicated."""
        names = [self.llm_model, *self.llm_fallback_models.split(",")]
        seen: list[str] = []
        for name in (n.strip() for n in names):
            if name and name not in seen:
                seen.append(name)
        return seen

    @property
    def sqlalchemy_url(self) -> str:
        """SQLAlchemy/psycopg3 URL, with Prisma's `?schema=public` stripped."""
        raw = self.assistant_database_url or self.database_url
        parts = urlsplit(raw)
        return urlunsplit(("postgresql+psycopg", parts.netloc, parts.path, "", ""))


settings = Settings()
