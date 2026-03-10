export type UUID = string;

export interface ProductOption {
  id: UUID;
  title: string;
  supplier: string;
  price: number;
  leadTimeDays: number;
}

export interface RoomObject {
  id: UUID;
  name: string;
  category: string;
  quantity: number;
  selectedProductId?: UUID;
  productOptions: ProductOption[];
}

export interface Room {
  id: UUID;
  houseId: UUID;
  name: string;
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
  houses: House[];
}
