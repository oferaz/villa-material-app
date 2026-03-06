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
