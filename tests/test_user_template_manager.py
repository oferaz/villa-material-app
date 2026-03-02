import user_template_manager as utm


def test_sanitize_template_dict_normalizes_objects(sample_template_map):
    result = utm.sanitize_template_dict(sample_template_map)

    assert list(result.keys()) == ["Living Room"]
    objects = result["Living Room"]
    assert len(objects) == 3

    assert objects[0] == {"key": "sofa", "name": "Sofa", "category": "General", "qty": 2}
    assert objects[1] == {"key": "floor_lamp", "name": "Floor Lamp", "category": "General", "qty": 1}
    assert objects[2] == {"key": "accent_table", "name": "Accent Table", "category": "Furniture", "qty": 1}


def test_template_payload_roundtrip(sample_template_map):
    payload = utm.template_payload_from_dict(sample_template_map)
    restored = utm.template_dict_from_payload(payload)

    assert payload["version"] == utm.TEMPLATE_VERSION
    assert restored == utm.sanitize_template_dict(sample_template_map)


def test_template_dict_from_payload_invalid_json_returns_empty():
    assert utm.template_dict_from_payload("{not-json") == {}


def test_extract_template_prefers_direct_column_over_nested(sample_template_map):
    direct_payload = utm.template_payload_from_dict(sample_template_map)
    nested_payload = utm.template_payload_from_dict({"Kitchen": [{"name": "Sink"}]})
    profile_row = {
        "villa_template": direct_payload,
        "settings": {"villa_template": nested_payload},
    }

    extracted = utm.extract_template_from_profile_row(profile_row)

    assert extracted == utm.sanitize_template_dict(sample_template_map)


def test_load_user_template_falls_back_to_default():
    loaded = utm.load_user_template_from_profile({})

    assert isinstance(loaded, dict)
    assert loaded
    assert "Living Room" in loaded


def test_save_user_template_requires_token_and_user_id():
    ok, msg = utm.save_user_template("", "", {}, {"Room": [{"name": "Item"}]})

    assert ok is False
    assert msg == "Session token missing."


def test_save_user_template_updates_profiles_table(monkeypatch, supabase_factory):
    fake_sb = supabase_factory()

    def fake_get_supabase(_access_token):
        return fake_sb

    monkeypatch.setattr(utm, "get_supabase", fake_get_supabase)

    ok, msg = utm.save_user_template(
        access_token="token-1",
        user_id="user-1",
        profile_row={"villa_template": {}},
        template_map={"Room": [{"name": "Item"}]},
    )

    assert ok is True
    assert msg is None
    assert fake_sb.last_table == "profiles"
    assert ("id", "user-1") in fake_sb.query.filters
    assert "villa_template" in fake_sb.query.update_payload


def test_save_user_template_retries_next_candidate_after_failure(monkeypatch, supabase_factory):
    attempts = [
        supabase_factory(fail_on_execute=True),
        supabase_factory(fail_on_execute=False),
    ]
    calls = {"count": 0}

    def fake_get_supabase(_access_token):
        idx = calls["count"]
        calls["count"] += 1
        return attempts[idx]

    monkeypatch.setattr(utm, "get_supabase", fake_get_supabase)

    ok, msg = utm.save_user_template(
        access_token="token-1",
        user_id="user-1",
        profile_row={"villa_template": {}, "template": {}},
        template_map={"Room": [{"name": "Item"}]},
    )

    assert ok is True
    assert msg is None
    assert calls["count"] == 2


def test_save_user_template_without_writable_field_returns_error():
    ok, msg = utm.save_user_template(
        access_token="token-1",
        user_id="user-1",
        profile_row={},
        template_map={"Room": [{"name": "Item"}]},
    )

    assert ok is False
    assert "Could not find a writable template field" in msg
