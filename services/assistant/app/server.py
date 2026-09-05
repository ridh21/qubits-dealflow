"""HTTP surface of the assistant microservice.

  GET  /health   liveness, plus whether the read-only role is really read-only
  POST /query    ask a question, get an answer and the SQL behind it

There is no browser-facing auth here on purpose. The service binds to localhost
and every request arrives through the Next.js proxy at /api/assistant/*, which
has already checked the internal session cookie. The shared `x-assistant-key`
header stops anything *else* on the host from calling it.
"""

from __future__ import annotations

import logging
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException
from langchain_core.messages import HumanMessage
from openai import APITimeoutError
from pydantic import BaseModel, Field

from .db import engine
from .graph import AllModelsBusy, answer, candidate_models
from .settings import settings

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("assistant")

app = FastAPI(title="DealFlow360 Assistant", docs_url=None, redoc_url=None)

def require_service_key(x_assistant_key: str | None = Header(default=None)) -> None:
    """Constant-time check of the shared secret between the Next.js proxy and here."""
    expected = settings.assistant_service_key
    if not expected:
        return  # unset in local dev; Compose always sets it
    if not x_assistant_key or not secrets.compare_digest(x_assistant_key, expected):
        raise HTTPException(status_code=401, detail="bad assistant key")


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=500)



@app.get("/health")
def health():
    """Liveness, and proof that the database connection really is read-only.

    Pointing the service at the application role instead of dealflow_readonly is
    the one misconfiguration that silently removes the main safety guarantee, so
    it is checked here rather than left to be discovered later.
    """
    database: dict[str, object] = {"connected": False, "readOnly": False}
    try:
        with engine().connect() as conn:
            database["user"] = conn.exec_driver_sql("SELECT current_user").scalar()
            database["readOnly"] = (
                conn.exec_driver_sql("SHOW default_transaction_read_only").scalar() == "on"
            )
            database["connected"] = True
    except Exception as failure:  # health must answer even when Postgres is down
        database["error"] = f"{type(failure).__name__}: {failure}"

    return {
        "ok": True,
        "service": "assistant",
        "model": {"configured": settings.llm_model, "usable": candidate_models()},
        "database": database,
    }


@app.post("/query", dependencies=[Depends(require_service_key)])
async def query(body: Question):
    """Answer one question. Never raises to the caller — a failure is an answer."""
    try:
        reply = await answer([HumanMessage(content=body.question)])
    except AllModelsBusy as busy:
        # Every configured model is over quota — a gateway condition, not a bug
        # in the question, so say so plainly instead of returning a 500.
        log.error("all models busy: %s", busy)
        return {
            "answer": "Every AI model is rate-limited right now — please try again shortly.",
            "sql": [],
        }
    except APITimeoutError:
        log.warning("LLM timed out: %s", body.question)
        return {
            "answer": "That took too long to work out — try asking something simpler.",
            "sql": [],
        }

    return {"answer": reply.answer, "sql": reply.sql, "model": reply.model}

