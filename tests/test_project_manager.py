import pytest

import project_manager as pm


class SessionState(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError as exc:  # pragma: no cover - mirrors streamlit attr access
            raise AttributeError(name) from exc

    def __setattr__(self, name, value):
        self[name] = value


class FakeStreamlit:
    def __init__(self):
        self.secrets = {}
        self.session_state = SessionState()
        self.errors = []
        self.warnings = []
        self.successes = []

    def error(self, message):
        self.errors.append(message)

    def warning(self, message):
        self.warnings.append(message)

    def success(self, message):
        self.successes.append(message)


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.operation = "select"
        self.payload = None
        self.filters = []
        self.order_key = None
        self.order_desc = False
        self.limit_count = None

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key, desc=False):
        self.order_key = key
        self.order_desc = desc
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def execute(self):
        if self.operation == "select":
            return FakeResult(self._select_rows())
        if self.operation == "insert":
            return FakeResult(self._insert_rows())
        if self.operation == "delete":
            return FakeResult(self._delete_rows())
        raise AssertionError(f"Unsupported operation: {self.operation}")

    def _select_rows(self):
        rows = [dict(row) for row in self.client.db[self.table_name] if self._matches(row)]
        if self.order_key:
            rows.sort(key=lambda row: str(row.get(self.order_key) or ""), reverse=self.order_desc)
        if self.limit_count is not None:
            rows = rows[: self.limit_count]
        return rows

    def _insert_rows(self):
        payload_rows = self.payload if isinstance(self.payload, list) else [self.payload]

        if self.table_name == "project_rooms":
            if self.client.room_insert_mode == "error":
                raise RuntimeError("forced room insert failure")
            if self.client.room_insert_mode == "empty":
                return []

        created = []
        for payload in payload_rows:
            row = dict(payload)
            row.setdefault("id", self.client.next_id(self.table_name))
            self.client.db[self.table_name].append(row)
            created.append(dict(row))
        return created

    def _delete_rows(self):
        kept = []
        deleted = []
        for row in self.client.db[self.table_name]:
            if self._matches(row):
                deleted.append(dict(row))
            else:
                kept.append(row)
        self.client.db[self.table_name] = kept
        self.client.deleted[self.table_name].extend(deleted)
        return deleted

    def _matches(self, row):
        return all(str(row.get(key)) == str(value) for key, value in self.filters)


class FakeSupabase:
    def __init__(self, *, room_insert_mode="normal", projects=None, project_rooms=None, room_objects=None):
        self.room_insert_mode = room_insert_mode
        self.db = {
            "projects": list(projects or []),
            "project_rooms": list(project_rooms or []),
            "room_objects": list(room_objects or []),
        }
        self.deleted = {"projects": [], "project_rooms": [], "room_objects": []}
        self._counters = {"projects": 0, "project_rooms": 0, "room_objects": 0}
        for table_name, rows in self.db.items():
            self._counters[table_name] = len(rows)

    def table(self, table_name):
        return FakeTable(self, table_name)

    def next_id(self, table_name):
        self._counters[table_name] += 1
        prefixes = {
            "projects": "project",
            "project_rooms": "room",
            "room_objects": "object",
        }
        return f"{prefixes[table_name]}-{self._counters[table_name]}"


def _install_test_context(monkeypatch, fake_sb):
    fake_st = FakeStreamlit()
    fake_st.session_state.sb_access_token = "token-1"
    fake_st.session_state.user_id = "user-1"
    monkeypatch.setattr(pm, "st", fake_st)
    monkeypatch.setattr(pm, "get_supabase", lambda _access_token: fake_sb)
    monkeypatch.setattr(pm, "load_projects", lambda: [])
    return fake_st


@pytest.mark.parametrize("room_insert_mode", ["error", "empty"])
def test_create_project_cleans_up_orphan_project_when_room_creation_fails(monkeypatch, room_insert_mode):
    fake_sb = FakeSupabase(room_insert_mode=room_insert_mode)
    fake_st = _install_test_context(monkeypatch, fake_sb)

    pm.create_project(
        "Desert Villa",
        rooms=["Living Room"],
        template_map={"Living Room": []},
    )

    assert fake_sb.db["projects"] == []
    assert fake_sb.deleted["projects"] == [{"id": "project-1", "name": "Desert Villa", "cart": [], "owner_id": "user-1"}]
    assert fake_st.session_state.get("current_project_id") is None
    assert fake_st.errors
    assert fake_st.successes == []


def test_create_project_normalizes_and_dedupes_room_names(monkeypatch):
    fake_sb = FakeSupabase()
    fake_st = _install_test_context(monkeypatch, fake_sb)

    pm.create_project(
        "Coastal Villa",
        rooms=[" Living Room ", "Living Room", "", "Kitchen  ", "Kitchen"],
        template_map={"Living Room": [], "Kitchen": []},
    )

    assert fake_st.errors == []
    assert [row["name"] for row in fake_sb.db["project_rooms"]] == ["Living Room", "Kitchen"]


def test_load_project_rooms_backfills_legacy_rooms_when_project_rows_are_empty(monkeypatch):
    fake_sb = FakeSupabase(
        projects=[
            {
                "id": "project-1",
                "name": "Archive Project",
                "rooms": [" Living Room ", "Kitchen", "Living Room", ""],
            }
        ],
        project_rooms=[],
    )
    _install_test_context(monkeypatch, fake_sb)

    rooms = pm.load_project_rooms("project-1")

    assert len(rooms) == 2
    assert {row["name"] for row in rooms} == {"Living Room", "Kitchen"}
    assert [row["name"] for row in fake_sb.db["project_rooms"]] == ["Living Room", "Kitchen"]


class ShareLookupResult:
    def __init__(self, data):
        self.data = data


class ShareLookupTable:
    def __init__(self, rows):
        self._rows = list(rows or [])
        self._limit = None
        self._share_token = None

    def select(self, *_args, **_kwargs):
        return self

    def contains(self, key, value):
        assert key == "cart"
        share = value.get("share") if isinstance(value, dict) else {}
        self._share_token = str(share.get("token") or "").strip()
        return self

    def limit(self, count):
        self._limit = count
        return self

    def execute(self):
        token = self._share_token
        matched = []
        for row in self._rows:
            cart = row.get("cart") if isinstance(row, dict) else {}
            share = cart.get("share") if isinstance(cart, dict) else {}
            row_token = str(share.get("token") or "").strip()
            if token and row_token == token:
                matched.append(dict(row))
        if self._limit is not None:
            matched = matched[: self._limit]
        return ShareLookupResult(matched)


class ShareLookupSupabase:
    def __init__(self, rows):
        self._rows = list(rows or [])

    def table(self, table_name):
        assert table_name == "projects"
        return ShareLookupTable(self._rows)


def test_get_project_share_from_row_coerces_enabled_variants():
    row_true = {"cart": {"share": {"token": "abc", "enabled": "true"}}}
    row_false = {"cart": {"share": {"token": "abc", "enabled": "false"}}}
    row_numeric = {"cart": {"share": {"token": "abc", "enabled": 1}}}

    assert pm.get_project_share_from_row(row_true)["enabled"] is True
    assert pm.get_project_share_from_row(row_false)["enabled"] is False
    assert pm.get_project_share_from_row(row_numeric)["enabled"] is True


def test_get_shared_project_by_token_accepts_string_enabled_true(monkeypatch):
    fake_st = FakeStreamlit()
    monkeypatch.setattr(pm, "st", fake_st)
    rows = [
        {
            "id": "project-1",
            "name": "Project One",
            "cart": {"share": {"token": "tok-1", "enabled": "true"}},
        }
    ]
    monkeypatch.setattr(pm, "get_supabase", lambda _access_token: ShareLookupSupabase(rows))

    project = pm.get_shared_project_by_token("tok-1")

    assert project is not None
    assert project["id"] == "project-1"


def test_get_shared_project_by_token_rejects_disabled_share(monkeypatch):
    fake_st = FakeStreamlit()
    monkeypatch.setattr(pm, "st", fake_st)
    rows = [
        {
            "id": "project-1",
            "name": "Project One",
            "cart": {"share": {"token": "tok-1", "enabled": False}},
        }
    ]
    monkeypatch.setattr(pm, "get_supabase", lambda _access_token: ShareLookupSupabase(rows))

    project = pm.get_shared_project_by_token("tok-1")

    assert project is None


def test_prune_project_cart_object_metadata_removes_order_stage(monkeypatch):
    captured = {}

    def fake_cart_items_and_meta(_project_id):
        return [], {
            "items": [],
            "procurement": {
                "notes": {"obj-1": "x", "obj-2": "y"},
                "quote_status": {"obj-1": "po_ready", "obj-2": "quote_requested"},
                "priority": {"obj-1": "high", "obj-2": "routine"},
                "target_price": {"obj-1": 100.0, "obj-2": 200.0},
                "order_stage": {"obj-1": "first_fix", "obj-2": "final_install"},
            },
        }

    def fake_save_project_cart(_project_id, payload):
        captured["payload"] = payload

    monkeypatch.setattr(pm, "_project_cart_items_and_meta", fake_cart_items_and_meta)
    monkeypatch.setattr(pm, "_save_project_cart", fake_save_project_cart)

    pm._prune_project_cart_object_metadata("project-1", ["obj-1"])

    procurement = captured["payload"]["procurement"]
    assert procurement["order_stage"] == {"obj-2": "final_install"}
    assert procurement["notes"] == {"obj-2": "y"}
