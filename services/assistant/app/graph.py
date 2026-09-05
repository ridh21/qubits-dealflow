"""The brain: a LangGraph ReAct agent with exactly one tool — a guarded SELECT.

Invoked by the FastAPI /query endpoint, which is the only caller.

It is deliberately given ONE tool rather than LangChain's SQLDatabaseToolkit.
The toolkit's list-tables/get-schema/query-checker tools would cost 4-6 LLM
round trips per question; the schema is already in the prompt, so writing the
SQL and reading the result is two — the difference between a 5-second answer and
a 15-second one, which matters when someone is waiting for it out loud.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache

from langchain_core.messages import AIMessage
from openai import APIStatusError, RateLimitError
from langchain_core.tools import tool
from langgraph.config import get_stream_writer
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import create_react_agent

from .db import run_select
from .prompt import system_prompt
from .readonly import UnsafeSQL
from .settings import settings

log = logging.getLogger("assistant.graph")


@tool
def query_database(query: str) -> str:
    """Run a read-only SQL SELECT against the DealFlow360 database and return the rows as JSON.

    Only SELECT statements are permitted. Table and column names are camelCase and must be
    double-quoted. Returns an error message you should read and correct if the query is
    invalid or not read-only.
    """
    try:
        rows = run_select(query)
    except UnsafeSQL as rejected:
        return f"REJECTED: {rejected}"
    except Exception as failure:  # surfaced back to the model so it can fix its SQL
        log.warning("query failed: %s", failure)
        return f"ERROR: {type(failure).__name__}: {failure}"

    if not rows:
        return "No rows matched."
    return json.dumps(rows, default=str)


def _is_capacity_error(failure: Exception) -> bool:
    """Is this the gateway saying "not now" rather than "never"?

    The gateway multiplexes several upstream providers and answers 429/503 with
    `no_account_available` once a provider's daily quota is spent. That is worth
    retrying on a different model; a 400 for a malformed request is not.
    """
    if isinstance(failure, RateLimitError):
        return True
    if isinstance(failure, APIStatusError):
        return failure.status_code in (429, 500, 502, 503, 504)
    return False


@lru_cache(maxsize=1)
def _listed_models() -> frozenset[str]:
    """Model ids the endpoint currently advertises, or empty if it won't say.

    The gateway drops a model from /v1/models once its accounts are exhausted,
    so this skips candidates that are already known to be gone. It is only a
    hint — a listed model can still 503 (observed), which is why the real
    protection is the retry loop in `answer`.
    """
    import httpx

    try:
        response = httpx.get(
            f"{settings.llm_base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            timeout=10,
        )
        response.raise_for_status()
        return frozenset(m["id"] for m in response.json().get("data", []))
    except Exception as failure:
        log.warning("could not list models (%s); will try all candidates", failure)
        return frozenset()


def candidate_models() -> list[str]:
    """Configured models in preference order, minus any already known to be gone."""
    preferred = settings.llm_candidates
    listed = _listed_models()
    if not listed:
        return preferred
    live = [name for name in preferred if name in listed]
    # Never return nothing: if the listing disagrees with every candidate, still
    # try the configured one so the error comes from the endpoint, not from here.
    return live or preferred[:1]


def _llm(model: str):
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(
        model=model,
        temperature=0,
        api_key=settings.llm_api_key or "not-needed",
        base_url=settings.llm_base_url or None,
        max_retries=settings.llm_max_retries,
        timeout=settings.llm_timeout,
    )


@lru_cache(maxsize=8)
def agent_for(model: str):
    """One compiled ReAct agent per model, built on first use and reused."""
    return create_react_agent(_llm(model), [query_database], prompt=system_prompt())


def answer_text(content) -> str:
    """Flatten message content (a string, or a list of content blocks) to text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        ).strip()
    return str(content)


class AllModelsBusy(RuntimeError):
    """Every configured model refused for capacity reasons."""


@dataclass(frozen=True)
class Reply:
    answer: str
    sql: list[str]
    model: str


async def answer(messages) -> Reply:
    """Ask the question, moving down the model list on capacity failures.

    Availability on this gateway changes within a single session — a model that
    answered a minute ago starts returning `no_account_available`, while still
    being advertised in /v1/models. Resolving a model once at startup therefore
    is not enough; the choice has to be able to change per request.
    """
    last: Exception | None = None
    for model in candidate_models():
        try:
            result = await agent_for(model).ainvoke({"messages": messages})
        except Exception as failure:
            if not _is_capacity_error(failure):
                raise
            log.warning("%s is out of capacity (%s); trying the next model", model, failure)
            last = failure
            continue
        return Reply(
            answer=answer_text(result["messages"][-1].content),
            sql=executed_sql(result["messages"]),
            model=model,
        )

    raise AllModelsBusy(str(last) if last else "no models configured")


def build_voice_graph():
    """Wrap the agent so only the FINAL sentence reaches text-to-speech.

    A raw ReAct agent streams its intermediate tool calls and row dumps. Piped
    into a voice pipeline, that means the assistant reads SQL aloud. So the
    agent is run to completion and only its last message is emitted, on the
    custom stream that LLMAdapter(stream_mode="custom") consumes.
    """

    async def respond(state: MessagesState):
        try:
            reply = await answer(state["messages"])
            spoken = reply.answer
        except AllModelsBusy:
            # Say something rather than going silent: in a voice call a dropped
            # turn is indistinguishable from the assistant having hung up.
            log.error("every model is out of capacity")
            spoken = "The AI service is busy right now. Please try again in a moment."
        get_stream_writer()(spoken)
        return {"messages": [AIMessage(content=spoken)]}

    builder = StateGraph(MessagesState)
    builder.add_node("respond", respond)
    builder.add_edge(START, "respond")
    builder.add_edge("respond", END)
    return builder.compile()


def executed_sql(messages) -> list[str]:
    """The SQL the agent actually ran, pulled out of its tool calls."""
    statements: list[str] = []
    for message in messages:
        for call in getattr(message, "tool_calls", None) or []:
            if call.get("name") == "query_database":
                sql = call.get("args", {}).get("query")
                if sql:
                    statements.append(sql)
    return statements
