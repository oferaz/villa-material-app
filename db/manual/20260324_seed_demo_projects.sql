-- Seed three realistic demo projects for the current workspace schema.
-- Update v_owner_email below if your Supabase auth email is different.
-- Optionally set v_collab_email to an existing auth.users email to grant
-- editor access to all three projects.

begin;

drop policy if exists "materials_project_member_select" on public.materials;
create policy "materials_project_member_select"
on public.materials
for select
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.room_objects ro
    join public.rooms r on r.id = ro.room_id
    join public.houses h on h.id = r.house_id
    join public.project_members pm on pm.project_id = h.project_id
    where ro.selected_material_id = materials.id
      and pm.user_id = auth.uid()
  )
);

drop policy if exists "material_images_project_member_select" on public.material_images;
create policy "material_images_project_member_select"
on public.material_images
for select
using (
  exists (
    select 1
    from public.materials m
    where m.id = material_images.material_id
      and (
        m.owner_user_id = auth.uid()
        or exists (
          select 1
          from public.room_objects ro
          join public.rooms r on r.id = ro.room_id
          join public.houses h on h.id = r.house_id
          join public.project_members pm on pm.project_id = h.project_id
          where ro.selected_material_id = m.id
            and pm.user_id = auth.uid()
        )
      )
  )
);

do $seed$
declare
  v_owner_email text := 'raz.oferaz@gmail.com';
  v_collab_email text := null;
  v_owner_user_id uuid;
  v_collab_user_id uuid;
  v_project jsonb;
  v_house jsonb;
  v_room jsonb;
  v_object jsonb;
  v_project_id uuid;
  v_house_id uuid;
  v_room_id uuid;
  v_material_id uuid;
  v_house_sort integer;
  v_room_sort integer;
  v_object_sort integer;
  v_category_name text;
  v_category_budget text;
  v_sku text;
  v_projects jsonb := $$[
    {
      "name": "Ananda Cliff Villa",
      "clientName": "Maya and Daniel Levin",
      "location": "Koh Samui, Thailand",
      "currency": "THB",
      "projectBudget": 22500000,
      "categoryBudgets": {
        "Furniture": 8000000,
        "Lighting": 1900000,
        "Tiles": 2700000,
        "Bathroom": 2300000,
        "Kitchen": 4200000,
        "Decor": 3400000
      },
      "houses": [
        {
          "name": "Main Villa",
          "sizeSqm": 340,
          "budget": 18000000,
          "rooms": [
            {
              "name": "Entry",
              "roomType": "entry",
              "sizeSqm": 24,
              "budget": 1200000,
              "objects": [
                {
                  "name": "Entry Console",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 50000,
                  "searchQuery": "entry console walnut",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-ananda-entry-console",
                    "name": "Walnut Entry Console",
                    "supplierName": "Atelier Siam",
                    "description": "Slim solid wood console with fluted drawer fronts.",
                    "budgetCategory": "Furniture",
                    "price": 42000,
                    "currency": "THB",
                    "leadTimeDays": 21,
                    "sourceUrl": "https://example.com/demo/ananda/walnut-entry-console",
                    "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Statement Mirror",
                  "category": "Decor",
                  "quantity": 1,
                  "budgetAllowance": 26000,
                  "searchQuery": "arched bronze mirror",
                  "poApproved": true,
                  "ordered": true,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-entry-mirror",
                    "name": "Arched Bronze Mirror",
                    "supplierName": "Form Haus",
                    "description": "Warm bronze framed mirror for the main arrival wall.",
                    "budgetCategory": "Decor",
                    "price": 22000,
                    "currency": "THB",
                    "leadTimeDays": 14,
                    "sourceUrl": "https://example.com/demo/ananda/arched-bronze-mirror",
                    "imageUrl": "https://images.unsplash.com/photo-1616627981459-a19a3177f7b2?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Living Room",
              "roomType": "living_room",
              "sizeSqm": 62,
              "budget": 4200000,
              "objects": [
                {
                  "name": "Modular Sofa",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 210000,
                  "searchQuery": "linen modular sofa",
                  "poApproved": true,
                  "ordered": true,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-living-sofa",
                    "name": "Oat Linen Modular Sofa",
                    "supplierName": "Nord Living",
                    "description": "Deep seat modular sofa in a washable oat linen blend.",
                    "budgetCategory": "Furniture",
                    "price": 185000,
                    "currency": "THB",
                    "leadTimeDays": 35,
                    "sourceUrl": "https://example.com/demo/ananda/oat-linen-sofa",
                    "imageUrl": "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Coffee Table",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 65000,
                  "searchQuery": "travertine coffee table",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-living-coffee-table",
                    "name": "Round Travertine Coffee Table",
                    "supplierName": "M Studio",
                    "description": "Low round coffee table with honed travertine top.",
                    "budgetCategory": "Furniture",
                    "price": 58000,
                    "currency": "THB",
                    "leadTimeDays": 28,
                    "sourceUrl": "https://example.com/demo/ananda/travertine-coffee-table",
                    "imageUrl": "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Pendant Fixture",
                  "category": "Lighting",
                  "quantity": 1,
                  "budgetAllowance": 78000,
                  "searchQuery": "living room sculptural pendant",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-living-pendant",
                    "name": "Sculptural Linen Pendant",
                    "supplierName": "Halo Lighting",
                    "description": "Oversized soft pendant that anchors the seating zone.",
                    "budgetCategory": "Lighting",
                    "price": 69000,
                    "currency": "THB",
                    "leadTimeDays": 30,
                    "sourceUrl": "https://example.com/demo/ananda/linen-pendant",
                    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Kitchen",
              "roomType": "kitchen",
              "sizeSqm": 38,
              "budget": 3500000,
              "objects": [
                {
                  "name": "Kitchen Faucet",
                  "category": "Kitchen",
                  "quantity": 1,
                  "budgetAllowance": 30000,
                  "searchQuery": "pull down kitchen faucet black",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-ananda-kitchen-faucet",
                    "name": "Matte Black Pull Down Faucet",
                    "supplierName": "Aqua Form",
                    "description": "Commercial style faucet with integrated sprayer.",
                    "budgetCategory": "Kitchen",
                    "price": 24500,
                    "currency": "THB",
                    "leadTimeDays": 12,
                    "sourceUrl": "https://example.com/demo/ananda/pull-down-faucet",
                    "imageUrl": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Counter Stools",
                  "category": "Furniture",
                  "quantity": 3,
                  "budgetAllowance": 45000,
                  "searchQuery": "counter stool teak cord",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-kitchen-counter-stools",
                    "name": "Teak and Cord Counter Stool",
                    "supplierName": "Baan Crafted",
                    "description": "Counter stool with hand woven cord seat and teak frame.",
                    "budgetCategory": "Furniture",
                    "price": 12500,
                    "currency": "THB",
                    "leadTimeDays": 18,
                    "sourceUrl": "https://example.com/demo/ananda/teak-counter-stool",
                    "imageUrl": "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Dining Room",
              "roomType": "dining_room",
              "sizeSqm": 28,
              "budget": 2000000,
              "objects": [
                {
                  "name": "Dining Table",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 145000,
                  "searchQuery": "solid oak dining table",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-dining-table",
                    "name": "Solid Oak Dining Table",
                    "supplierName": "Loom House",
                    "description": "Large solid oak table sized for eight guests.",
                    "budgetCategory": "Furniture",
                    "price": 128000,
                    "currency": "THB",
                    "leadTimeDays": 32,
                    "sourceUrl": "https://example.com/demo/ananda/solid-oak-dining-table",
                    "imageUrl": "https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Master Bedroom",
              "roomType": "bedroom",
              "sizeSqm": 44,
              "budget": 4000000,
              "objects": [
                {
                  "name": "Upholstered Bed",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 120000,
                  "searchQuery": "upholstered bed sand fabric",
                  "poApproved": true,
                  "ordered": true,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-master-bed",
                    "name": "Sand Upholstered Bed",
                    "supplierName": "Quiet Forms",
                    "description": "Soft channel tufted bed with low platform base.",
                    "budgetCategory": "Furniture",
                    "price": 98000,
                    "currency": "THB",
                    "leadTimeDays": 26,
                    "sourceUrl": "https://example.com/demo/ananda/sand-upholstered-bed",
                    "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Bedside Pendant",
                  "category": "Lighting",
                  "quantity": 2,
                  "budgetAllowance": 22000,
                  "searchQuery": "bedside pendant smoked glass",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-master-bedside-pendant",
                    "name": "Smoked Glass Bedside Pendant",
                    "supplierName": "Halo Lighting",
                    "description": "Compact smoked glass pendant for each side of the bed.",
                    "budgetCategory": "Lighting",
                    "price": 8900,
                    "currency": "THB",
                    "leadTimeDays": 16,
                    "sourceUrl": "https://example.com/demo/ananda/smoked-glass-pendant",
                    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Master Bathroom",
              "roomType": "bathroom",
              "sizeSqm": 19,
              "budget": 3100000,
              "objects": [
                {
                  "name": "Vanity Mirror",
                  "category": "Bathroom",
                  "quantity": 1,
                  "budgetAllowance": 24000,
                  "searchQuery": "backlit vanity mirror",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-ananda-master-vanity-mirror",
                    "name": "Backlit Vanity Mirror",
                    "supplierName": "Aqua Form",
                    "description": "Circular anti fog mirror with warm dimmable backlight.",
                    "budgetCategory": "Bathroom",
                    "price": 18500,
                    "currency": "THB",
                    "leadTimeDays": 10,
                    "sourceUrl": "https://example.com/demo/ananda/backlit-vanity-mirror",
                    "imageUrl": "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            }
          ]
        },
        {
          "name": "Pool House",
          "sizeSqm": 95,
          "budget": 4500000,
          "rooms": [
            {
              "name": "Guest Bedroom",
              "roomType": "bedroom",
              "sizeSqm": 24,
              "budget": 1700000,
              "objects": [
                {
                  "name": "Platform Bed",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 70000,
                  "searchQuery": "platform bed teak",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-guest-platform-bed",
                    "name": "Teak Platform Bed",
                    "supplierName": "Baan Crafted",
                    "description": "Clean lined teak platform bed for the pool house suite.",
                    "budgetCategory": "Furniture",
                    "price": 54000,
                    "currency": "THB",
                    "leadTimeDays": 20,
                    "sourceUrl": "https://example.com/demo/ananda/teak-platform-bed",
                    "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Guest Bathroom",
              "roomType": "bathroom",
              "sizeSqm": 10,
              "budget": 1100000,
              "objects": [
                {
                  "name": "Shower Fixture Set",
                  "category": "Bathroom",
                  "quantity": 1,
                  "budgetAllowance": 24000,
                  "searchQuery": "brushed nickel shower set",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-ananda-guest-shower-set",
                    "name": "Brushed Nickel Shower Set",
                    "supplierName": "Aqua Form",
                    "description": "Rain shower set with hand shower and thermostatic mixer.",
                    "budgetCategory": "Bathroom",
                    "price": 17500,
                    "currency": "THB",
                    "leadTimeDays": 12,
                    "sourceUrl": "https://example.com/demo/ananda/brushed-nickel-shower-set",
                    "imageUrl": "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Outdoor Terrace",
              "roomType": "outdoor",
              "sizeSqm": 34,
              "budget": 1700000,
              "objects": [
                {
                  "name": "Sun Lounger Set",
                  "category": "Furniture",
                  "quantity": 2,
                  "budgetAllowance": 150000,
                  "searchQuery": "sun lounger teak mesh",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-ananda-sun-lounger-set",
                    "name": "Teak Sun Lounger",
                    "supplierName": "Coast Outdoor",
                    "description": "Weather ready teak lounger with quick dry mesh sling.",
                    "budgetCategory": "Furniture",
                    "price": 63000,
                    "currency": "THB",
                    "leadTimeDays": 18,
                    "sourceUrl": "https://example.com/demo/ananda/teak-sun-lounger",
                    "imageUrl": "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": "Saffron Courtyard Residences",
      "clientName": "Luna Development",
      "location": "Phuket, Thailand",
      "currency": "THB",
      "projectBudget": 31800000,
      "categoryBudgets": {
        "Furniture": 11000000,
        "Lighting": 3000000,
        "Tiles": 4400000,
        "Bathroom": 4800000,
        "Kitchen": 5600000,
        "Decor": 3000000
      },
      "houses": [
        {
          "name": "Building A",
          "sizeSqm": 210,
          "budget": 16000000,
          "rooms": [
            {
              "name": "Entry",
              "roomType": "entry",
              "sizeSqm": 18,
              "budget": 1000000,
              "objects": [
                {
                  "name": "Reception Bench",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 42000,
                  "searchQuery": "entry bench boucle",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-a-reception-bench",
                    "name": "Boucle Reception Bench",
                    "supplierName": "Nord Living",
                    "description": "Compact rounded bench for the shared residence entry.",
                    "budgetCategory": "Furniture",
                    "price": 36000,
                    "currency": "THB",
                    "leadTimeDays": 22,
                    "sourceUrl": "https://example.com/demo/saffron/boucle-reception-bench",
                    "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Living Room",
              "roomType": "living_room",
              "sizeSqm": 48,
              "budget": 4200000,
              "objects": [
                {
                  "name": "Sectional Sofa",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 175000,
                  "searchQuery": "sectional sofa warm gray",
                  "poApproved": true,
                  "ordered": true,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-a-sectional-sofa",
                    "name": "Warm Gray Sectional Sofa",
                    "supplierName": "Forma Studio",
                    "description": "Large family sized sectional for the model unit lounge.",
                    "budgetCategory": "Furniture",
                    "price": 158000,
                    "currency": "THB",
                    "leadTimeDays": 30,
                    "sourceUrl": "https://example.com/demo/saffron/warm-gray-sectional-sofa",
                    "imageUrl": "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Wall Washer Track",
                  "category": "Lighting",
                  "quantity": 1,
                  "budgetAllowance": 48000,
                  "searchQuery": "track light wall washer",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-saffron-a-wall-washer-track",
                    "name": "Minimal Wall Washer Track",
                    "supplierName": "Halo Lighting",
                    "description": "Low profile adjustable track lighting for art walls.",
                    "budgetCategory": "Lighting",
                    "price": 41000,
                    "currency": "THB",
                    "leadTimeDays": 14,
                    "sourceUrl": "https://example.com/demo/saffron/minimal-wall-washer-track",
                    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Kitchen",
              "roomType": "kitchen",
              "sizeSqm": 30,
              "budget": 4100000,
              "objects": [
                {
                  "name": "Quartz Backsplash Tile",
                  "category": "Tiles",
                  "quantity": 18,
                  "budgetAllowance": 42000,
                  "searchQuery": "quartz backsplash tile ivory",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-a-backsplash-tile",
                    "name": "Ivory Quartz Backsplash Tile",
                    "supplierName": "Stone Gallery",
                    "description": "Warm ivory slab style tile used for the kitchen splash wall.",
                    "budgetCategory": "Tiles",
                    "price": 1650,
                    "currency": "THB",
                    "leadTimeDays": 25,
                    "sourceUrl": "https://example.com/demo/saffron/ivory-quartz-backsplash-tile",
                    "imageUrl": "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Bedroom",
              "roomType": "bedroom",
              "sizeSqm": 32,
              "budget": 3300000,
              "objects": [
                {
                  "name": "Oak Wardrobe",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 125000,
                  "searchQuery": "oak wardrobe full height",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-a-oak-wardrobe",
                    "name": "Full Height Oak Wardrobe",
                    "supplierName": "Timber Lab",
                    "description": "Built in look wardrobe with oak veneer fronts.",
                    "budgetCategory": "Furniture",
                    "price": 112000,
                    "currency": "THB",
                    "leadTimeDays": 28,
                    "sourceUrl": "https://example.com/demo/saffron/full-height-oak-wardrobe",
                    "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Bathroom",
              "roomType": "bathroom",
              "sizeSqm": 14,
              "budget": 3400000,
              "objects": [
                {
                  "name": "Ribbed Vanity",
                  "category": "Bathroom",
                  "quantity": 1,
                  "budgetAllowance": 72000,
                  "searchQuery": "ribbed oak vanity",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-a-ribbed-vanity",
                    "name": "Ribbed Oak Vanity",
                    "supplierName": "Aqua Form",
                    "description": "Ribbed oak vanity with integrated stone top.",
                    "budgetCategory": "Bathroom",
                    "price": 62000,
                    "currency": "THB",
                    "leadTimeDays": 24,
                    "sourceUrl": "https://example.com/demo/saffron/ribbed-oak-vanity",
                    "imageUrl": "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            }
          ]
        },
        {
          "name": "Building B",
          "sizeSqm": 205,
          "budget": 15800000,
          "rooms": [
            {
              "name": "Living Room",
              "roomType": "living_room",
              "sizeSqm": 46,
              "budget": 4000000,
              "objects": [
                {
                  "name": "Linen Sofa",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 160000,
                  "searchQuery": "linen sofa sand",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-b-linen-sofa",
                    "name": "Sand Linen Sofa",
                    "supplierName": "Forma Studio",
                    "description": "Clean profile sofa sized for compact family living.",
                    "budgetCategory": "Furniture",
                    "price": 144000,
                    "currency": "THB",
                    "leadTimeDays": 27,
                    "sourceUrl": "https://example.com/demo/saffron/sand-linen-sofa",
                    "imageUrl": "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Kitchen",
              "roomType": "kitchen",
              "sizeSqm": 28,
              "budget": 4300000,
              "objects": [
                {
                  "name": "Bar Pull Cabinet Set",
                  "category": "Kitchen",
                  "quantity": 1,
                  "budgetAllowance": 30000,
                  "searchQuery": "brushed brass bar pulls",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-saffron-b-bar-pull-set",
                    "name": "Brushed Brass Bar Pull Set",
                    "supplierName": "Forge Studio",
                    "description": "Full hardware set for kitchen doors and drawers.",
                    "budgetCategory": "Kitchen",
                    "price": 22000,
                    "currency": "THB",
                    "leadTimeDays": 9,
                    "sourceUrl": "https://example.com/demo/saffron/brushed-brass-bar-pull-set",
                    "imageUrl": "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Bedroom",
              "roomType": "bedroom",
              "sizeSqm": 31,
              "budget": 3200000,
              "objects": [
                {
                  "name": "Headboard Wall Light",
                  "category": "Lighting",
                  "quantity": 2,
                  "budgetAllowance": 22000,
                  "searchQuery": "wall light headboard brass",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-b-headboard-wall-light",
                    "name": "Brass Headboard Wall Light",
                    "supplierName": "Halo Lighting",
                    "description": "Adjustable brass wall light used on both sides of the bed.",
                    "budgetCategory": "Lighting",
                    "price": 7900,
                    "currency": "THB",
                    "leadTimeDays": 11,
                    "sourceUrl": "https://example.com/demo/saffron/brass-headboard-wall-light",
                    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Bathroom",
              "roomType": "bathroom",
              "sizeSqm": 12,
              "budget": 2200000,
              "objects": [
                {
                  "name": "Freestanding Basin Mixer",
                  "category": "Bathroom",
                  "quantity": 1,
                  "budgetAllowance": 36000,
                  "searchQuery": "freestanding basin mixer",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-saffron-b-basin-mixer",
                    "name": "Freestanding Basin Mixer",
                    "supplierName": "Aqua Form",
                    "description": "Tall basin mixer for vessel sink installations.",
                    "budgetCategory": "Bathroom",
                    "price": 31500,
                    "currency": "THB",
                    "leadTimeDays": 13,
                    "sourceUrl": "https://example.com/demo/saffron/freestanding-basin-mixer",
                    "imageUrl": "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Outdoor Terrace",
              "roomType": "outdoor",
              "sizeSqm": 22,
              "budget": 2100000,
              "objects": [
                {
                  "name": "Outdoor Bistro Set",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 65000,
                  "searchQuery": "outdoor bistro set powder coat",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-saffron-b-bistro-set",
                    "name": "Powder Coated Bistro Set",
                    "supplierName": "Coast Outdoor",
                    "description": "Compact metal table and chair set for private terraces.",
                    "budgetCategory": "Furniture",
                    "price": 54000,
                    "currency": "THB",
                    "leadTimeDays": 15,
                    "sourceUrl": "https://example.com/demo/saffron/powder-coated-bistro-set",
                    "imageUrl": "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": "Riverside Guest House Refresh",
      "clientName": "Siam Hospitality",
      "location": "Chiang Mai, Thailand",
      "currency": "THB",
      "projectBudget": 12400000,
      "categoryBudgets": {
        "Furniture": 4500000,
        "Lighting": 1800000,
        "Tiles": 1200000,
        "Bathroom": 1700000,
        "Kitchen": 1400000,
        "Decor": 1800000
      },
      "houses": [
        {
          "name": "Guest House",
          "sizeSqm": 180,
          "budget": 12400000,
          "rooms": [
            {
              "name": "Lounge",
              "roomType": "living_room",
              "sizeSqm": 36,
              "budget": 2600000,
              "objects": [
                {
                  "name": "Curved Sofa",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 145000,
                  "searchQuery": "curved sofa cream",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-riverside-curved-sofa",
                    "name": "Cream Curved Sofa",
                    "supplierName": "Quiet Forms",
                    "description": "Soft curved sofa for the shared guest lounge.",
                    "budgetCategory": "Furniture",
                    "price": 132000,
                    "currency": "THB",
                    "leadTimeDays": 29,
                    "sourceUrl": "https://example.com/demo/riverside/cream-curved-sofa",
                    "imageUrl": "https://images.unsplash.com/photo-1493666438817-866a91353ca9?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Textured Rug",
                  "category": "Decor",
                  "quantity": 1,
                  "budgetAllowance": 42000,
                  "searchQuery": "textured rug natural",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-riverside-textured-rug",
                    "name": "Natural Textured Rug",
                    "supplierName": "Loom House",
                    "description": "Handwoven rug in warm natural fibers.",
                    "budgetCategory": "Decor",
                    "price": 34000,
                    "currency": "THB",
                    "leadTimeDays": 12,
                    "sourceUrl": "https://example.com/demo/riverside/natural-textured-rug",
                    "imageUrl": "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Office",
              "roomType": "office",
              "sizeSqm": 18,
              "budget": 1600000,
              "objects": [
                {
                  "name": "Built-in Desk",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 70000,
                  "searchQuery": "built in desk oak veneer",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-riverside-built-in-desk",
                    "name": "Oak Veneer Built-in Desk",
                    "supplierName": "Timber Lab",
                    "description": "Wall to wall desk with cable tray and oak veneer finish.",
                    "budgetCategory": "Furniture",
                    "price": 56000,
                    "currency": "THB",
                    "leadTimeDays": 18,
                    "sourceUrl": "https://example.com/demo/riverside/oak-veneer-built-in-desk",
                    "imageUrl": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Bedroom",
              "roomType": "bedroom",
              "sizeSqm": 26,
              "budget": 2400000,
              "objects": [
                {
                  "name": "Canopy Bed",
                  "category": "Furniture",
                  "quantity": 1,
                  "budgetAllowance": 98000,
                  "searchQuery": "canopy bed black frame",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-riverside-canopy-bed",
                    "name": "Black Frame Canopy Bed",
                    "supplierName": "Forma Studio",
                    "description": "Lightweight steel canopy bed for boutique guest rooms.",
                    "budgetCategory": "Furniture",
                    "price": 86000,
                    "currency": "THB",
                    "leadTimeDays": 24,
                    "sourceUrl": "https://example.com/demo/riverside/black-frame-canopy-bed",
                    "imageUrl": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Laundry",
              "roomType": "laundry",
              "sizeSqm": 12,
              "budget": 900000,
              "objects": [
                {
                  "name": "Utility Sink Faucet",
                  "category": "Kitchen",
                  "quantity": 1,
                  "budgetAllowance": 13000,
                  "searchQuery": "utility sink faucet",
                  "poApproved": true,
                  "ordered": true,
                  "installed": true,
                  "material": {
                    "sku": "demo-riverside-utility-faucet",
                    "name": "Utility Sink Faucet",
                    "supplierName": "Aqua Form",
                    "description": "Simple chrome faucet for the service sink zone.",
                    "budgetCategory": "Kitchen",
                    "price": 9800,
                    "currency": "THB",
                    "leadTimeDays": 7,
                    "sourceUrl": "https://example.com/demo/riverside/utility-sink-faucet",
                    "imageUrl": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Outdoor Courtyard",
              "roomType": "outdoor",
              "sizeSqm": 28,
              "budget": 2100000,
              "objects": [
                {
                  "name": "Planter Trio",
                  "category": "Decor",
                  "quantity": 3,
                  "budgetAllowance": 18000,
                  "searchQuery": "planter trio stone",
                  "poApproved": true,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-riverside-planter-trio",
                    "name": "Stone Planter Trio",
                    "supplierName": "Coast Outdoor",
                    "description": "Set of three weathered stone planters for the courtyard edge.",
                    "budgetCategory": "Decor",
                    "price": 4500,
                    "currency": "THB",
                    "leadTimeDays": 9,
                    "sourceUrl": "https://example.com/demo/riverside/stone-planter-trio",
                    "imageUrl": "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80"
                  }
                },
                {
                  "name": "Outdoor Wall Lantern",
                  "category": "Lighting",
                  "quantity": 2,
                  "budgetAllowance": 16000,
                  "searchQuery": "outdoor wall lantern black",
                  "poApproved": false,
                  "ordered": false,
                  "installed": false,
                  "material": {
                    "sku": "demo-riverside-wall-lantern",
                    "name": "Black Outdoor Wall Lantern",
                    "supplierName": "Halo Lighting",
                    "description": "Powder coated exterior lantern for the courtyard walls.",
                    "budgetCategory": "Lighting",
                    "price": 6200,
                    "currency": "THB",
                    "leadTimeDays": 11,
                    "sourceUrl": "https://example.com/demo/riverside/black-outdoor-wall-lantern",
                    "imageUrl": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            },
            {
              "name": "Bathroom",
              "roomType": "bathroom",
              "sizeSqm": 11,
              "budget": 2800000,
              "objects": [
                {
                  "name": "Stone Basin",
                  "category": "Bathroom",
                  "quantity": 1,
                  "budgetAllowance": 18000,
                  "searchQuery": "stone basin vessel",
                  "poApproved": true,
                  "ordered": true,
                  "installed": false,
                  "material": {
                    "sku": "demo-riverside-stone-basin",
                    "name": "Stone Vessel Basin",
                    "supplierName": "Stone Gallery",
                    "description": "Hand carved basin that gives the guest bath a spa feel.",
                    "budgetCategory": "Bathroom",
                    "price": 14800,
                    "currency": "THB",
                    "leadTimeDays": 14,
                    "sourceUrl": "https://example.com/demo/riverside/stone-vessel-basin",
                    "imageUrl": "https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&q=80"
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]$$::jsonb;
begin
  select id
  into v_owner_user_id
  from auth.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_owner_user_id is null then
    raise exception 'Owner user not found in auth.users for email: %', v_owner_email;
  end if;

  if nullif(trim(coalesce(v_collab_email, '')), '') is not null then
    select id
    into v_collab_user_id
    from auth.users
    where lower(email) = lower(v_collab_email)
    limit 1;

    if v_collab_user_id is null then
      raise exception 'Collaborator user not found in auth.users for email: %', v_collab_email;
    end if;
  end if;

  insert into public.profiles (id)
  values (v_owner_user_id)
  on conflict (id) do nothing;

  if v_collab_user_id is not null then
    insert into public.profiles (id)
    values (v_collab_user_id)
    on conflict (id) do nothing;
  end if;

  for v_project in
    select value
    from jsonb_array_elements(v_projects)
  loop
    select p.id
    into v_project_id
    from public.projects p
    where p.created_by = v_owner_user_id
      and lower(p.name) = lower(coalesce(v_project ->> 'name', ''))
    order by p.created_at
    limit 1;

    if v_project_id is null then
      insert into public.projects (
        name,
        client_name,
        location,
        currency,
        created_by
      )
      values (
        coalesce(v_project ->> 'name', 'Demo Project'),
        nullif(v_project ->> 'clientName', ''),
        nullif(v_project ->> 'location', ''),
        coalesce(v_project ->> 'currency', 'THB'),
        v_owner_user_id
      )
      returning id into v_project_id;
    else
      update public.projects
      set
        client_name = nullif(v_project ->> 'clientName', ''),
        location = nullif(v_project ->> 'location', ''),
        currency = coalesce(v_project ->> 'currency', 'THB'),
        updated_at = now()
      where id = v_project_id;
    end if;

    insert into public.project_members (project_id, user_id, role)
    values (v_project_id, v_owner_user_id, 'owner')
    on conflict (project_id, user_id) do update
      set role = excluded.role;

    if v_collab_user_id is not null then
      insert into public.project_members (project_id, user_id, role)
      values (v_project_id, v_collab_user_id, 'editor')
      on conflict (project_id, user_id) do update
        set role = excluded.role
        where public.project_members.role <> 'owner';
    end if;

    delete from public.project_room_budgets
    where project_id = v_project_id;

    delete from public.project_house_budgets
    where project_id = v_project_id;

    delete from public.project_budget_categories
    where project_id = v_project_id;

    delete from public.houses
    where project_id = v_project_id;

    insert into public.project_budgets (project_id, total_budget, currency)
    values (
      v_project_id,
      coalesce(nullif(v_project ->> 'projectBudget', '')::numeric, 0),
      coalesce(v_project ->> 'currency', 'THB')
    )
    on conflict (project_id) do update
      set total_budget = excluded.total_budget,
          currency = excluded.currency,
          updated_at = now();

    for v_category_name, v_category_budget in
      select key, value
      from jsonb_each_text(coalesce(v_project -> 'categoryBudgets', '{}'::jsonb))
    loop
      if v_category_name in ('Furniture', 'Lighting', 'Tiles', 'Bathroom', 'Kitchen', 'Decor') then
        insert into public.project_budget_categories (
          project_id,
          category_name,
          total_budget
        )
        values (
          v_project_id,
          v_category_name,
          coalesce(nullif(v_category_budget, '')::numeric, 0)
        );
      end if;
    end loop;

    v_house_sort := 0;

    for v_house in
      select value
      from jsonb_array_elements(coalesce(v_project -> 'houses', '[]'::jsonb))
    loop
      insert into public.houses (
        project_id,
        name,
        size_sq_m,
        sort_order
      )
      values (
        v_project_id,
        coalesce(v_house ->> 'name', 'House'),
        nullif(v_house ->> 'sizeSqm', '')::numeric,
        v_house_sort
      )
      returning id into v_house_id;

      if nullif(v_house ->> 'budget', '') is not null then
        insert into public.project_house_budgets (
          project_id,
          house_id,
          total_budget
        )
        values (
          v_project_id,
          v_house_id,
          (v_house ->> 'budget')::numeric
        );
      end if;

      v_room_sort := 0;

      for v_room in
        select value
        from jsonb_array_elements(coalesce(v_house -> 'rooms', '[]'::jsonb))
      loop
        insert into public.rooms (
          house_id,
          name,
          size_sq_m,
          room_type,
          sort_order
        )
        values (
          v_house_id,
          coalesce(v_room ->> 'name', 'Room'),
          nullif(v_room ->> 'sizeSqm', '')::numeric,
          coalesce(v_room ->> 'roomType', 'living_room'),
          v_room_sort
        )
        returning id into v_room_id;

        if nullif(v_room ->> 'budget', '') is not null then
          insert into public.project_room_budgets (
            project_id,
            room_id,
            total_budget
          )
          values (
            v_project_id,
            v_room_id,
            (v_room ->> 'budget')::numeric
          );
        end if;

        v_object_sort := 0;

        for v_object in
          select value
          from jsonb_array_elements(coalesce(v_room -> 'objects', '[]'::jsonb))
        loop
          v_material_id := null;

          if jsonb_typeof(v_object -> 'material') = 'object' then
            v_sku := nullif(trim(coalesce(v_object -> 'material' ->> 'sku', '')), '');

            if v_sku is null then
              v_sku := lower(
                regexp_replace(
                  coalesce(v_project ->> 'name', 'demo') || '-' ||
                  coalesce(v_room ->> 'name', 'room') || '-' ||
                  coalesce(v_object ->> 'name', 'object'),
                  '[^a-zA-Z0-9]+',
                  '-',
                  'g'
                )
              );
            end if;

            select m.id
            into v_material_id
            from public.materials m
            where m.owner_user_id = v_owner_user_id
              and m.sku = v_sku
            order by m.created_at
            limit 1;

            if v_material_id is null then
              insert into public.materials (
                owner_user_id,
                supplier_name,
                name,
                description,
                budget_category,
                price,
                currency,
                lead_time_days,
                sku,
                source_type,
                source_url,
                is_private
              )
              values (
                v_owner_user_id,
                nullif(v_object -> 'material' ->> 'supplierName', ''),
                coalesce(v_object -> 'material' ->> 'name', coalesce(v_object ->> 'name', 'Demo Material')),
                nullif(v_object -> 'material' ->> 'description', ''),
                coalesce(v_object -> 'material' ->> 'budgetCategory', 'Furniture'),
                nullif(v_object -> 'material' ->> 'price', '')::numeric,
                coalesce(v_object -> 'material' ->> 'currency', coalesce(v_project ->> 'currency', 'THB')),
                nullif(v_object -> 'material' ->> 'leadTimeDays', '')::integer,
                v_sku,
                case
                  when nullif(trim(coalesce(v_object -> 'material' ->> 'sourceUrl', '')), '') is not null then 'link'
                  else 'manual'
                end,
                nullif(v_object -> 'material' ->> 'sourceUrl', ''),
                false
              )
              returning id into v_material_id;
            else
              update public.materials
              set
                supplier_name = nullif(v_object -> 'material' ->> 'supplierName', ''),
                name = coalesce(v_object -> 'material' ->> 'name', coalesce(v_object ->> 'name', name)),
                description = nullif(v_object -> 'material' ->> 'description', ''),
                budget_category = coalesce(v_object -> 'material' ->> 'budgetCategory', budget_category),
                price = nullif(v_object -> 'material' ->> 'price', '')::numeric,
                currency = coalesce(v_object -> 'material' ->> 'currency', coalesce(v_project ->> 'currency', currency)),
                lead_time_days = nullif(v_object -> 'material' ->> 'leadTimeDays', '')::integer,
                source_type = case
                  when nullif(trim(coalesce(v_object -> 'material' ->> 'sourceUrl', '')), '') is not null then 'link'
                  else 'manual'
                end,
                source_url = nullif(v_object -> 'material' ->> 'sourceUrl', ''),
                is_private = false,
                updated_at = now()
              where id = v_material_id;
            end if;

            delete from public.material_images
            where material_id = v_material_id;

            if nullif(trim(coalesce(v_object -> 'material' ->> 'imageUrl', '')), '') is not null then
              insert into public.material_images (
                material_id,
                image_url,
                sort_order
              )
              values (
                v_material_id,
                v_object -> 'material' ->> 'imageUrl',
                0
              );
            end if;
          end if;

          insert into public.room_objects (
            room_id,
            name,
            category,
            quantity,
            budget_allowance,
            material_search_query,
            selected_material_id,
            po_approved,
            is_ordered,
            is_installed,
            sort_order
          )
          values (
            v_room_id,
            coalesce(v_object ->> 'name', 'Object'),
            coalesce(v_object ->> 'category', 'Custom'),
            greatest(1, coalesce((v_object ->> 'quantity')::integer, 1)),
            nullif(v_object ->> 'budgetAllowance', '')::numeric,
            coalesce(
              nullif(trim(coalesce(v_object ->> 'searchQuery', '')), ''),
              lower(coalesce(v_object ->> 'name', 'object'))
            ),
            v_material_id,
            coalesce((v_object ->> 'poApproved')::boolean, false),
            coalesce((v_object ->> 'ordered')::boolean, false),
            coalesce((v_object ->> 'installed')::boolean, false),
            v_object_sort
          );

          v_object_sort := v_object_sort + 1;
        end loop;

        v_room_sort := v_room_sort + 1;
      end loop;

      v_house_sort := v_house_sort + 1;
    end loop;

    raise notice 'Seeded demo project: %', v_project ->> 'name';
  end loop;
end;
$seed$;

commit;
