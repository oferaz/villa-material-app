import sys
import types
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _ensure_streamlit_stub():
    if "streamlit" in sys.modules:
        return

    module = types.ModuleType("streamlit")
    module.secrets = {}

    def cache_resource(*_args, **_kwargs):
        def decorator(func):
            return func

        return decorator

    module.cache_resource = cache_resource
    sys.modules["streamlit"] = module


def _ensure_supabase_stub():
    if "supabase" in sys.modules:
        return

    module = types.ModuleType("supabase")

    class Client:  # pragma: no cover - type placeholder for imports
        pass

    class _Postgrest:
        def auth(self, _access_token):
            return None

    class _DummyClient:
        def __init__(self):
            self.postgrest = _Postgrest()

    def create_client(_url, _key):
        return _DummyClient()

    module.Client = Client
    module.create_client = create_client
    sys.modules["supabase"] = module


def _ensure_dotenv_stub():
    if "dotenv" in sys.modules:
        return

    module = types.ModuleType("dotenv")

    def load_dotenv(*_args, **_kwargs):
        return True

    module.load_dotenv = load_dotenv
    sys.modules["dotenv"] = module


_ensure_streamlit_stub()
_ensure_supabase_stub()
_ensure_dotenv_stub()


class FakeQuery:
    def __init__(self, fail_on_execute=False):
        self.fail_on_execute = fail_on_execute
        self.update_payload = None
        self.filters = []

    def update(self, payload):
        self.update_payload = payload
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def execute(self):
        if self.fail_on_execute:
            raise RuntimeError("forced execute failure")
        return {"ok": True}


class FakeSupabase:
    def __init__(self, fail_on_execute=False):
        self.last_table = None
        self.query = FakeQuery(fail_on_execute=fail_on_execute)

    def table(self, table_name):
        self.last_table = table_name
        return self.query


@pytest.fixture
def sample_template_map():
    return {
        "Living Room": [
            {"name": "Sofa", "qty": "2"},
            "Floor Lamp",
            {"key": "accent_table", "category": "Furniture", "qty": 0},
        ]
    }


@pytest.fixture
def profile_row_direct():
    return {"id": "user-1", "villa_template": {"version": 1, "rooms": []}}


@pytest.fixture
def supabase_factory():
    def _factory(*, fail_on_execute=False):
        return FakeSupabase(fail_on_execute=fail_on_execute)

    return _factory
