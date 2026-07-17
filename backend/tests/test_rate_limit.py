"""The AI routes must refuse to spend without bound.

Both agent routes call Anthropic on every request. They are authenticated, so this was never a
leak — but any signed-in user could hold the button down and bill the org for it.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.api.rate_limit import AI_CALLS_PER_WINDOW, _reset_for_tests
from tests.conftest import ADMIN_USER_ID, create_user, use_user


@pytest.fixture(autouse=True)
def _clean_counters():
    """Counters live in module state for the life of the process, so tests would leak into
    each other — one test's calls would rate-limit the next."""
    _reset_for_tests()
    yield
    _reset_for_tests()


def _stub_agent(monkeypatch) -> None:
    """Replace the agent entirely — both halves of it.

    `BaseAgent.__init__` raises without ANTHROPIC_API_KEY, and the route wraps every exception in a
    500. So stubbing only `categorize_ingredient` left the constructor to fail, the route to return
    500, and the rate-limit gate never to be reached: the test would have "passed" a 429 assertion
    only by accident, and failed the 200 one for a reason that had nothing to do with limiting.
    """

    def _init(self, session, organization_id):  # noqa: ANN001
        self.session = session
        self.organization_id = organization_id

    async def _categorize(self, ingredient_name: str):  # noqa: ANN001
        # Must satisfy CategorizeIngredientResponse — a short return 500s on validation, which
        # looks exactly like the agent failing and tells you nothing about the limiter.
        return {
            "category_id": 1,
            "category_name": "Test",
            "explanation": "stub",
            "success": True,
        }

    monkeypatch.setattr("app.agents.category_agent.CategoryAgent.__init__", _init)
    monkeypatch.setattr(
        "app.agents.category_agent.CategoryAgent.categorize_ingredient", _categorize
    )


def test_the_ai_route_429s_once_the_allowance_is_gone(
    client: TestClient, session: Session, monkeypatch
):
    """The agent itself is stubbed: this is about the gate, not about Anthropic."""
    use_user(client, create_user(session, ADMIN_USER_ID, "admin"))

    _stub_agent(monkeypatch)
    body = {"ingredient_name": "Tomato"}
    ok = [
        client.post("/api/v1/agents/categorize-ingredient", json=body).status_code
        for _ in range(AI_CALLS_PER_WINDOW)
    ]
    assert all(code == 200 for code in ok), f"the allowance must be usable: {ok}"

    blocked = client.post("/api/v1/agents/categorize-ingredient", json=body)
    assert blocked.status_code == 429, "the call past the allowance must be refused"
    assert blocked.headers.get("Retry-After"), "a 429 must say when to come back"


def test_the_limit_is_per_user_not_global(client: TestClient, session: Session, monkeypatch):
    """One user exhausting their allowance must not lock out their colleagues.

    Keyed on the user id for exactly this reason — an IP would put a whole kitchen behind one NAT
    on a single budget.
    """

    _stub_agent(monkeypatch)
    body = {"ingredient_name": "Tomato"}

    use_user(client, create_user(session, "heavy-user", "heavy"))
    for _ in range(AI_CALLS_PER_WINDOW):
        client.post("/api/v1/agents/categorize-ingredient", json=body)
    assert client.post("/api/v1/agents/categorize-ingredient", json=body).status_code == 429

    use_user(client, create_user(session, "other-user", "other"))
    assert (
        client.post("/api/v1/agents/categorize-ingredient", json=body).status_code == 200
    ), "a second user must have their own allowance"
