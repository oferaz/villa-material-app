import { ProductOption, Project, RoomObject, RoomType } from "@/types";

export interface SuggestedObjectTemplate {
  name: string;
  category: string;
  basePrice: number;
}

interface RoomSeed {
  name: string;
  type: RoomType;
  objectCount?: number;
}

interface HouseSeed {
  name: string;
  rooms: RoomSeed[];
}

interface ProjectSeed {
  id: string;
  name: string;
  customer: string;
  location: string;
  houses: HouseSeed[];
}

const optionStyles = ["Studio", "Essential", "Signature", "Premium"];
const suppliers = [
  "Atelier Living",
  "Linea Habitat",
  "Stone Form",
  "Nordic House",
  "Urban Foundry",
  "Madera Works",
  "Lumen Studio",
  "Aqua Systems",
];

export const roomTypeLabels: Record<RoomType, string> = {
  living_room: "Living Room",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  bedroom: "Bedroom",
  dining_room: "Dining Room",
  entry: "Entry",
  office: "Office",
  laundry: "Laundry",
  outdoor: "Outdoor",
};

export const suggestedObjectsByRoomType: Record<RoomType, SuggestedObjectTemplate[]> = {
  living_room: [
    { name: "Sofa", category: "Furniture", basePrice: 36000 },
    { name: "Coffee Table", category: "Furniture", basePrice: 12000 },
    { name: "Rug", category: "Textiles", basePrice: 9000 },
    { name: "Curtains", category: "Textiles", basePrice: 7000 },
    { name: "Lighting", category: "Lighting", basePrice: 11000 },
    { name: "TV Unit", category: "Joinery", basePrice: 25000 },
    { name: "Accent Chair", category: "Furniture", basePrice: 15000 },
    { name: "Side Table", category: "Furniture", basePrice: 5500 },
  ],
  kitchen: [
    { name: "Sink", category: "Fixtures", basePrice: 7000 },
    { name: "Faucet", category: "Fixtures", basePrice: 4800 },
    { name: "Cabinets", category: "Joinery", basePrice: 42000 },
    { name: "Bar Stools", category: "Furniture", basePrice: 8500 },
    { name: "Pendant Lights", category: "Lighting", basePrice: 10500 },
    { name: "Countertop", category: "Surface", basePrice: 28000 },
    { name: "Backsplash", category: "Finishes", basePrice: 14500 },
    { name: "Appliance Set", category: "Appliances", basePrice: 59000 },
  ],
  bathroom: [
    { name: "Vanity", category: "Joinery", basePrice: 16000 },
    { name: "Mirror", category: "Fixtures", basePrice: 4500 },
    { name: "Shower Set", category: "Fixtures", basePrice: 7200 },
    { name: "Toilet", category: "Fixtures", basePrice: 6300 },
    { name: "Accessories", category: "Accessories", basePrice: 2200 },
    { name: "Wall Sconce", category: "Lighting", basePrice: 3900 },
    { name: "Towel Warmer", category: "Accessories", basePrice: 5600 },
    { name: "Bath Mixer", category: "Fixtures", basePrice: 6900 },
  ],
  bedroom: [
    { name: "Bed Frame", category: "Furniture", basePrice: 26000 },
    { name: "Nightstands", category: "Furniture", basePrice: 8200 },
    { name: "Wardrobe", category: "Joinery", basePrice: 31000 },
    { name: "Blackout Curtains", category: "Textiles", basePrice: 6400 },
    { name: "Bedside Lighting", category: "Lighting", basePrice: 4200 },
    { name: "Bench", category: "Furniture", basePrice: 7200 },
    { name: "Desk", category: "Furniture", basePrice: 12500 },
    { name: "Accent Rug", category: "Textiles", basePrice: 5600 },
  ],
  dining_room: [
    { name: "Dining Table", category: "Furniture", basePrice: 26000 },
    { name: "Dining Chairs", category: "Furniture", basePrice: 17000 },
    { name: "Sideboard", category: "Joinery", basePrice: 22000 },
    { name: "Pendant Light", category: "Lighting", basePrice: 8200 },
    { name: "Area Rug", category: "Textiles", basePrice: 7600 },
    { name: "Art Wall", category: "Decor", basePrice: 11000 },
    { name: "Table Runner", category: "Textiles", basePrice: 1600 },
    { name: "Display Shelf", category: "Joinery", basePrice: 9400 },
  ],
  entry: [
    { name: "Console Table", category: "Furniture", basePrice: 9800 },
    { name: "Entry Mirror", category: "Decor", basePrice: 3600 },
    { name: "Shoe Cabinet", category: "Joinery", basePrice: 9200 },
    { name: "Pendant Lamp", category: "Lighting", basePrice: 5400 },
    { name: "Bench", category: "Furniture", basePrice: 6600 },
    { name: "Umbrella Stand", category: "Accessories", basePrice: 1200 },
    { name: "Wall Hooks", category: "Accessories", basePrice: 900 },
    { name: "Doormat", category: "Textiles", basePrice: 700 },
  ],
  office: [
    { name: "Desk", category: "Furniture", basePrice: 12500 },
    { name: "Task Chair", category: "Furniture", basePrice: 6100 },
    { name: "Storage Unit", category: "Joinery", basePrice: 11200 },
    { name: "Desk Lamp", category: "Lighting", basePrice: 2400 },
    { name: "Pinboard", category: "Accessories", basePrice: 1400 },
    { name: "Bookshelf", category: "Joinery", basePrice: 10300 },
    { name: "Acoustic Panel", category: "Finishes", basePrice: 5400 },
    { name: "Window Blinds", category: "Textiles", basePrice: 3500 },
  ],
  laundry: [
    { name: "Washer", category: "Appliances", basePrice: 21000 },
    { name: "Dryer", category: "Appliances", basePrice: 24000 },
    { name: "Utility Sink", category: "Fixtures", basePrice: 5000 },
    { name: "Storage Shelves", category: "Joinery", basePrice: 8300 },
    { name: "Hanging Rail", category: "Accessories", basePrice: 1600 },
    { name: "Folding Counter", category: "Surface", basePrice: 7800 },
    { name: "Laundry Baskets", category: "Accessories", basePrice: 1200 },
    { name: "Task Light", category: "Lighting", basePrice: 1900 },
  ],
  outdoor: [
    { name: "Outdoor Sofa", category: "Furniture", basePrice: 33000 },
    { name: "Lounger", category: "Furniture", basePrice: 14700 },
    { name: "Outdoor Rug", category: "Textiles", basePrice: 7800 },
    { name: "Planters", category: "Decor", basePrice: 4200 },
    { name: "Wall Lantern", category: "Lighting", basePrice: 3800 },
    { name: "Dining Set", category: "Furniture", basePrice: 29000 },
    { name: "Fire Pit", category: "Accessories", basePrice: 11900 },
    { name: "Pergola Shades", category: "Textiles", basePrice: 12500 },
  ],
};

const projectSeeds: ProjectSeed[] = [
  {
    id: "project-palm-heights",
    name: "Palm Heights",
    customer: "Haddad Family",
    location: "Jumeirah, Dubai",
    houses: [
      {
        name: "North Villa",
        rooms: [
          { name: "Living Room", type: "living_room", objectCount: 6 },
          { name: "Kitchen", type: "kitchen", objectCount: 6 },
          { name: "Master Bedroom", type: "bedroom", objectCount: 5 },
          { name: "Master Bathroom", type: "bathroom", objectCount: 5 },
        ],
      },
      {
        name: "Sky Courtyard",
        rooms: [
          { name: "Entry Lobby", type: "entry", objectCount: 4 },
          { name: "Dining Room", type: "dining_room", objectCount: 5 },
          { name: "Guest Bedroom", type: "bedroom", objectCount: 5 },
          { name: "Laundry Room", type: "laundry", objectCount: 4 },
        ],
      },
      {
        name: "Pool House",
        rooms: [
          { name: "Outdoor Lounge", type: "outdoor", objectCount: 6 },
          { name: "Pool Bathroom", type: "bathroom", objectCount: 4 },
          { name: "Service Kitchen", type: "kitchen", objectCount: 5 },
        ],
      },
    ],
  },
  {
    id: "project-lagoon-terraces",
    name: "Lagoon Terraces",
    customer: "Ari Development",
    location: "Al Khobar, Saudi Arabia",
    houses: [
      {
        name: "Villa Azure",
        rooms: [
          { name: "Main Living", type: "living_room", objectCount: 6 },
          { name: "Chef Kitchen", type: "kitchen", objectCount: 6 },
          { name: "Dining Hall", type: "dining_room", objectCount: 5 },
          { name: "Primary Suite", type: "bedroom", objectCount: 6 },
          { name: "Primary Bath", type: "bathroom", objectCount: 5 },
        ],
      },
      {
        name: "Villa Sand",
        rooms: [
          { name: "Family Lounge", type: "living_room", objectCount: 5 },
          { name: "Study", type: "office", objectCount: 5 },
          { name: "Guest Bath", type: "bathroom", objectCount: 4 },
          { name: "Outdoor Deck", type: "outdoor", objectCount: 5 },
        ],
      },
    ],
  },
];

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rotate<T>(items: T[], startIndex: number): T[] {
  if (items.length === 0) {
    return [];
  }
  const safeIndex = startIndex % items.length;
  return [...items.slice(safeIndex), ...items.slice(0, safeIndex)];
}

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
}

function buildProductOptions(objectName: string, basePrice: number, seed: string): ProductOption[] {
  const hash = hashSeed(seed);
  const optionCount = (hash % 3) + 2; // 2-4 options

  return Array.from({ length: optionCount }, (_, optionIndex) => {
    const supplierIndex = (hash + optionIndex) % suppliers.length;
    const styleIndex = (hash + optionIndex) % optionStyles.length;
    const priceMultiplier = 0.85 + optionIndex * 0.15;
    const price = Math.round(basePrice * priceMultiplier / 100) * 100;

    return {
      id: `${toSlug(seed)}-option-${optionIndex + 1}`,
      name: `${optionStyles[styleIndex]} ${objectName}`,
      supplier: suppliers[supplierIndex],
      price,
      leadTimeDays: 12 + ((hash + optionIndex * 7) % 28),
      sku: `${toSlug(objectName).toUpperCase()}-${(hash + optionIndex * 13).toString().slice(-4)}`,
      sourceType: "catalog",
    };
  });
}

export function getSuggestedObjectsForRoomType(roomType: RoomType): SuggestedObjectTemplate[] {
  return suggestedObjectsByRoomType[roomType] ?? [];
}

export function createMockRoomObject(
  roomId: string,
  objectName: string,
  category = "Custom",
  basePrice = 8500,
  seed = `${roomId}-${objectName}`
): RoomObject {
  const objectId = `${roomId}-object-${toSlug(objectName)}-${Math.floor(Math.random() * 100000)}`;
  return {
    id: objectId,
    roomId,
    name: objectName,
    category,
    productOptions: buildProductOptions(objectName, basePrice, seed),
  };
}

function buildProjects(): Project[] {
  return projectSeeds.map((projectSeed, projectIndex) => {
    const projectId = projectSeed.id;

    return {
      id: projectId,
      name: projectSeed.name,
      customer: projectSeed.customer,
      location: projectSeed.location,
      houses: projectSeed.houses.map((houseSeed, houseIndex) => {
        const houseId = `${projectId}-house-${houseIndex + 1}`;
        return {
          id: houseId,
          projectId,
          name: houseSeed.name,
          rooms: houseSeed.rooms.map((roomSeed, roomIndex) => {
            const roomId = `${houseId}-room-${roomIndex + 1}`;
            const roomTemplates = suggestedObjectsByRoomType[roomSeed.type];
            const orderedTemplates = rotate(roomTemplates, projectIndex + houseIndex + roomIndex);
            const objectCount = Math.max(4, Math.min(roomSeed.objectCount ?? 5, 8));
            const objectTemplates = orderedTemplates.slice(0, objectCount);

            return {
              id: roomId,
              houseId,
              name: roomSeed.name,
              type: roomSeed.type,
              objects: objectTemplates.map((template, objectIndex) => {
                const objectId = `${roomId}-object-${objectIndex + 1}`;
                const optionSeed = `${projectId}-${houseSeed.name}-${roomSeed.name}-${template.name}`;
                const productOptions = buildProductOptions(template.name, template.basePrice, optionSeed);
                const shouldStartSelected = objectIndex % 3 === 0;

                return {
                  id: objectId,
                  roomId,
                  name: template.name,
                  category: template.category,
                  productOptions,
                  selectedProductId: shouldStartSelected ? productOptions[0]?.id : undefined,
                };
              }),
            };
          }),
        };
      }),
    };
  });
}

export const mockProjects: Project[] = buildProjects();

export function getProjectById(projectId: string): Project | undefined {
  return mockProjects.find((project) => project.id === projectId);
}
