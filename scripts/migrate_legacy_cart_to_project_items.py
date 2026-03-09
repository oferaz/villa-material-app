import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


CATEGORY_VALUES = {
    "sanitary",
    "tiles",
    "furniture",
    "lighting",
    "paint",
    "kitchen",
    "appliances",
    "decor",
    "outdoor",
    "hardware",
    "other",
}

STATUS_VALUES = {"draft", "quoted", "approved", "ordered", "delivered", "paid"}


def normalize_category(value):
    text = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "bathroom": "sanitary",
        "plumbing": "sanitary",
        "tile": "tiles",
        "light": "lighting",
        "appliance": "appliances",
        "decoration": "decor",
        "fixture": "hardware",
    }
    text = aliases.get(text, text)
    return text if text in CATEGORY_VALUES else "other"


def normalize_status(value):
    text = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    if text in STATUS_VALUES:
        return text
    legacy = {
        "selected": "quoted",
        "designer_approved": "approved",
        "client_approved": "approved",
    }
    return legacy.get(text, "draft")


def safe_num(value, default=None):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def cart_items_from_project(project_row):
    cart = project_row.get("cart")
    if isinstance(cart, list):
        return cart
    if isinstance(cart, dict):
        items = cart.get("items")
        if isinstance(items, list):
            return items
    return []


def main():
    parser = argparse.ArgumentParser(description="Migrate legacy projects.cart JSON items into project_items rows.")
    parser.add_argument("--dry-run", action="store_true", help="Do not insert anything, only report.")
    parser.add_argument("--limit-projects", type=int, default=0, help="Only process first N projects.")
    parser.add_argument(
        "--log-file",
        default="migration_cart_to_project_items_log.jsonl",
        help="Path to write unmatched/diagnostic log records.",
    )
    parser.add_argument(
        "--write-log-table",
        action="store_true",
        help="Also write unmatched rows into legacy_migration_log table when present.",
    )
    args = parser.parse_args()

    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not url or not service_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY in environment.")

    sb = create_client(url, service_key)
    projects = sb.table("projects").select("id,name,currency,cart").order("created_at").execute().data or []
    if args.limit_projects > 0:
        projects = projects[: args.limit_projects]

    rooms = sb.table("rooms").select("id,project_id,name").execute().data or []
    room_map = {}
    for row in rooms:
        project_id = str(row.get("project_id"))
        room_name = str(row.get("name") or "").strip().casefold()
        if not project_id or not room_name:
            continue
        room_map[(project_id, room_name)] = row.get("id")

    suppliers = sb.table("suppliers").select("id,name").execute().data or []
    supplier_map = {
        str(row.get("name") or "").strip().casefold(): row.get("id")
        for row in suppliers
        if row.get("id") and str(row.get("name") or "").strip()
    }

    log_path = Path(args.log_file)
    inserted_count = 0
    skipped_count = 0
    log_records = []

    for project in projects:
        project_id = str(project.get("id"))
        project_currency = str(project.get("currency") or "THB").strip().upper() or "THB"
        items = cart_items_from_project(project)
        if not items:
            continue

        existing_rows = (
            sb.table("project_items")
            .select("name,room_id")
            .eq("project_id", project_id)
            .execute()
            .data
            or []
        )
        existing_keys = {
            (str(row.get("name") or "").strip().casefold(), str(row.get("room_id") or ""))
            for row in existing_rows
        }

        to_insert = []
        for item in items:
            if not isinstance(item, dict):
                skipped_count += 1
                log_records.append(
                    {
                        "project_id": project_id,
                        "source": "projects.cart",
                        "message": "Skipped non-object cart entry",
                        "payload": item,
                    }
                )
                continue

            name = (
                str(item.get("name") or item.get("product_name") or item.get("title") or "").strip()
            )
            if not name:
                skipped_count += 1
                log_records.append(
                    {
                        "project_id": project_id,
                        "source": "projects.cart",
                        "message": "Skipped item with no name/title",
                        "payload": item,
                    }
                )
                continue

            room_name = str(item.get("room") or "").strip().casefold()
            room_id = room_map.get((project_id, room_name)) if room_name else None
            supplier_name = str(item.get("supplier") or item.get("supplier_name") or "").strip()
            supplier_id = None
            if supplier_name:
                supplier_key = supplier_name.casefold()
                supplier_id = supplier_map.get(supplier_key)
                if not supplier_id and not args.dry_run:
                    created = sb.table("suppliers").insert({"name": supplier_name}).execute().data or []
                    supplier_id = created[0].get("id") if created else None
                    if supplier_id:
                        supplier_map[supplier_key] = supplier_id

            quantity = safe_num(item.get("quantity"), default=None)
            if quantity is None:
                quantity = safe_num(item.get("qty"), default=1.0)
            if quantity is None or quantity <= 0:
                quantity = 1.0

            unit_price = safe_num(item.get("unit_price"), default=None)
            if unit_price is None:
                unit_price = safe_num(item.get("price"), default=None)

            row_payload = {
                "project_id": project_id,
                "room_id": str(room_id) if room_id else None,
                "name": name,
                "category": normalize_category(item.get("category") or item.get("type")),
                "supplier_id": str(supplier_id) if supplier_id else None,
                "spec": (str(item.get("spec") or "").strip() or None),
                "quantity": float(quantity),
                "unit": (str(item.get("unit") or "").strip() or None),
                "unit_price": unit_price,
                "currency": str(item.get("currency") or project_currency).strip().upper() or "THB",
                "status": normalize_status(item.get("status")),
                "notes": (
                    str(item.get("notes") or item.get("note") or item.get("description") or "").strip() or None
                ),
            }

            row_key = (name.casefold(), str(room_id or ""))
            if row_key in existing_keys:
                skipped_count += 1
                continue
            existing_keys.add(row_key)
            to_insert.append(row_payload)

            if room_name and not room_id:
                log_records.append(
                    {
                        "project_id": project_id,
                        "source": "projects.cart",
                        "message": "Room name could not be mapped; imported item with NULL room_id",
                        "payload": {"room_name": room_name, "item": item},
                    }
                )

        if not to_insert:
            continue

        if args.dry_run:
            inserted_count += len(to_insert)
            continue

        batch_size = 200
        for idx in range(0, len(to_insert), batch_size):
            batch = to_insert[idx : idx + batch_size]
            sb.table("project_items").insert(batch).execute()
            inserted_count += len(batch)

    if log_records:
        with log_path.open("w", encoding="utf-8") as handle:
            for record in log_records:
                handle.write(json.dumps(record, ensure_ascii=True) + "\n")

        if args.write_log_table and not args.dry_run:
            chunk = 200
            for idx in range(0, len(log_records), chunk):
                rows = log_records[idx : idx + chunk]
                payload = [
                    {
                        "project_id": row.get("project_id"),
                        "source": row.get("source") or "projects.cart",
                        "message": row.get("message") or "migration note",
                        "payload": row.get("payload"),
                    }
                    for row in rows
                ]
                try:
                    sb.table("legacy_migration_log").insert(payload).execute()
                except Exception:
                    break

    print(
        json.dumps(
            {
                "processed_projects": len(projects),
                "inserted_rows": inserted_count,
                "skipped_rows": skipped_count,
                "log_records": len(log_records),
                "dry_run": bool(args.dry_run),
            }
        )
    )


if __name__ == "__main__":
    main()
