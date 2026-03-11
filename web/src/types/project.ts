export type UUID = string;

export type RoomType =
  | "living_room"
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "dining_room"
  | "entry"
  | "office"
  | "laundry"
  | "outdoor";

export interface ProductOption {
  id: UUID;
  name: string;
  supplier: string;
  price: number;
  leadTimeDays: number;
  sku?: string;
  imageUrl?: string;
  sourceType?: "catalog" | "link";
  sourceUrl?: string;
}

export type ObjectStatus = "selected" | "missing";

export interface RoomObject {
  id: UUID;
  roomId: UUID;
  name: string;
  category: string;
  selectedProductId?: UUID;
  productOptions: ProductOption[];
}

export interface Room {
  id: UUID;
  houseId: UUID;
  name: string;
  type: RoomType;
  objects: RoomObject[];
}

export interface House {
  id: UUID;
  projectId: UUID;
  name: string;
  rooms: Room[];
}

export interface Project {
  id: UUID;
  name: string;
  customer: string;
  location: string;
  houses: House[];
}

export function getObjectStatus(roomObject: RoomObject): ObjectStatus {
  return roomObject.selectedProductId ? "selected" : "missing";
}

