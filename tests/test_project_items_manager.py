import project_items_manager as pim


class SessionState(dict):
    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError as exc:
            raise AttributeError(name) from exc

    def __setattr__(self, name, value):
        self[name] = value


class FakeStreamlit:
    def __init__(self):
        self.session_state = SessionState()


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeTable:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.op = "select"
        self.payload = None
        self.filters = []
        self.order_by = []
        self.limit_count = None

    def select(self, *_args, **_kwargs):
        self.op = "select"
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key, desc=False):
        self.order_by.append((key, desc))
        return self

    def limit(self, count):
        self.limit_count = count
        return self

    def insert(self, payload):
        self.op = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.op = "update"
        self.payload = payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        if self.op == "select":
            return FakeResult(self._select())
        if self.op == "insert":
            return FakeResult(self._insert())
        if self.op == "update":
            return FakeResult(self._update())
        if self.op == "delete":
            return FakeResult(self._delete())
        raise AssertionError(f"unsupported op: {self.op}")

    def _filtered_rows(self):
        rows = [dict(r) for r in self.client.db[self.table_name]]
        for key, value in self.filters:
            rows = [r for r in rows if str(r.get(key)) == str(value)]
        return rows

    def _select(self):
        rows = self._filtered_rows()
        for key, desc in reversed(self.order_by):
            rows.sort(key=lambda r: str(r.get(key) or ""), reverse=desc)
        if self.limit_count is not None:
            rows = rows[: self.limit_count]
        return rows

    def _insert(self):
        rows = self.payload if isinstance(self.payload, list) else [self.payload]
        created = []
        for row in rows:
            obj = dict(row)
            obj.setdefault("id", self.client.next_id(self.table_name))
            self.client.db[self.table_name].append(obj)
            created.append(dict(obj))
        return created

    def _update(self):
        updated = []
        for row in self.client.db[self.table_name]:
            ok = True
            for key, value in self.filters:
                if str(row.get(key)) != str(value):
                    ok = False
                    break
            if ok:
                row.update(dict(self.payload))
                updated.append(dict(row))
        return updated

    def _delete(self):
        kept = []
        deleted = []
        for row in self.client.db[self.table_name]:
            ok = True
            for key, value in self.filters:
                if str(row.get(key)) != str(value):
                    ok = False
                    break
            if ok:
                deleted.append(dict(row))
            else:
                kept.append(row)
        self.client.db[self.table_name] = kept
        return deleted


class FakeSupabase:
    def __init__(self):
        self.db = {
            "projects": [{"id": "project-1", "name": "Villa One", "owner_id": "user-1"}],
            "rooms": [{"id": "room-1", "project_id": "project-1", "name": "Bathroom 1", "type": "bathroom", "sort_order": 0}],
            "suppliers": [{"id": "sup-1", "name": "Store A"}],
            "catalog_items": [
                {
                    "id": "cat-1",
                    "name": "Toilet Model X",
                    "category": "sanitary",
                    "default_price": 1200,
                    "currency": "THB",
                    "supplier_id": "sup-1",
                    "description": "dual flush",
                }
            ],
            "project_items": [],
            "room_templates": [
                {"id": "tpl-1", "room_type": "bathroom", "category": "sanitary", "name": "Sink", "default_unit": "pcs", "default_qty": 1, "sort_order": 1},
                {"id": "tpl-2", "room_type": "bathroom", "category": "tiles", "name": "Wall Tiles", "default_unit": "sqm", "default_qty": 10, "sort_order": 2},
            ],
        }
        self.counters = {name: len(rows) for name, rows in self.db.items()}

    def next_id(self, table_name):
        self.counters[table_name] += 1
        return f"{table_name[:-1]}-{self.counters[table_name]}"

    def table(self, table_name):
        return FakeTable(self, table_name)


def _install_context(monkeypatch):
    fake_st = FakeStreamlit()
    fake_st.session_state.sb_access_token = "token-1"
    fake_st.session_state.user_id = "user-1"
    fake_sb = FakeSupabase()
    monkeypatch.setattr(pim, "st", fake_st)
    monkeypatch.setattr(pim, "get_supabase", lambda _token: fake_sb)
    return fake_sb


def test_add_project_item_normalizes_category_and_status(monkeypatch):
    fake_sb = _install_context(monkeypatch)
    row = pim.add_project_item(
        project_id="project-1",
        room_id="room-1",
        name="Accent Light",
        category="Light",
        status="selected",
        quantity=2,
        supplier_name="Store A",
    )

    assert row["category"] == "lighting"
    assert row["status"] == "draft"
    assert row["supplier_id"] == "sup-1"
    assert len(fake_sb.db["project_items"]) == 1


def test_add_catalog_item_to_project_creates_snapshot(monkeypatch):
    fake_sb = _install_context(monkeypatch)
    row = pim.add_catalog_item_to_project(
        project_id="project-1",
        room_id="room-1",
        catalog_item_id="cat-1",
        quantity=3,
    )

    assert row["catalog_item_id"] == "cat-1"
    assert row["name"] == "Toilet Model X"
    assert row["quantity"] == 3
    assert row["status"] == "draft"


def test_groupings_return_expected_blocks(monkeypatch):
    _install_context(monkeypatch)
    pim.add_project_item(project_id="project-1", room_id="room-1", name="Sink", category="sanitary", quantity=1, supplier_name="Store A", unit_price=100)
    pim.add_project_item(project_id="project-1", room_id=None, name="Outdoor Lamp", category="lighting", quantity=2, supplier_name="Store A", unit_price=50)

    by_room = pim.list_project_items_grouped_by_room("project-1")
    by_supplier = pim.list_project_items_grouped_by_supplier("project-1")
    by_category = pim.list_project_items_grouped_by_category("project-1")

    assert len(by_room) == 2
    assert any(group["label"] == "Bathroom 1" for group in by_room)
    assert len(by_supplier) == 1
    assert len(by_category) == 2


def test_generate_room_checklist_skips_existing(monkeypatch):
    fake_sb = _install_context(monkeypatch)
    pim.add_project_item(project_id="project-1", room_id="room-1", name="Sink", category="sanitary", quantity=1)

    result = pim.generate_room_checklist(project_id="project-1", room_id="room-1", replace_existing=False)

    assert result["inserted"] == 1
    assert result["skipped"] == 1
    assert len(fake_sb.db["project_items"]) == 2


def test_update_project_item_normalizes_fields(monkeypatch):
    _install_context(monkeypatch)
    created = pim.add_project_item(
        project_id="project-1",
        room_id="room-1",
        name="Wall Light",
        category="lighting",
        quantity=1,
        status="draft",
    )

    updated = pim.update_project_item(
        created["id"],
        {
            "category": "fixture",
            "status": "designer approved",
            "quantity": 0,
            "currency": "thb",
            "unit_price": "250.5",
            "notes": "  note here  ",
        },
    )

    assert updated is not None
    assert updated["category"] == "hardware"
    assert updated["status"] == "draft"
    assert updated["quantity"] == 1.0
    assert updated["currency"] == "THB"
    assert updated["unit_price"] == 250.5
    assert updated["notes"] == "note here"


def test_add_project_item_creates_missing_supplier(monkeypatch):
    fake_sb = _install_context(monkeypatch)
    row = pim.add_project_item(
        project_id="project-1",
        room_id="room-1",
        name="Outdoor Tile",
        category="tile",
        supplier_name="New Supplier",
    )

    assert row["supplier_id"] is not None
    assert any(s["name"] == "New Supplier" for s in fake_sb.db["suppliers"])


def test_list_project_items_enriches_room_supplier_and_line_total(monkeypatch):
    _install_context(monkeypatch)
    pim.add_project_item(
        project_id="project-1",
        room_id="room-1",
        name="Mirror",
        category="decor",
        supplier_name="Store A",
        quantity=2,
        unit_price=175,
    )
    rows = pim.list_project_items("project-1")

    assert len(rows) == 1
    assert rows[0]["room_name"] == "Bathroom 1"
    assert rows[0]["supplier_name"] == "Store A"
    assert rows[0]["line_total"] == 350


def test_generate_room_checklist_replace_existing_true(monkeypatch):
    fake_sb = _install_context(monkeypatch)
    pim.add_project_item(project_id="project-1", room_id="room-1", name="Sink", category="sanitary", quantity=1)

    result = pim.generate_room_checklist(project_id="project-1", room_id="room-1", replace_existing=True)

    assert result["inserted"] == 2
    assert result["skipped"] == 0
    assert len(fake_sb.db["project_items"]) == 3
