import { Project } from "@/types";

export const mockProjects: Project[] = [
  {
    id: "project-a",
    name: "Palm Residence",
    customer: "Haddad Family",
    houses: [
      {
        id: "house-a1",
        projectId: "project-a",
        name: "House 01",
        rooms: [
          {
            id: "room-a1-1",
            houseId: "house-a1",
            name: "Living Room",
            objects: [
              {
                id: "obj-a1",
                name: "Main Sofa",
                category: "Furniture",
                quantity: 1,
                selectedProductId: "prod-a1",
                productOptions: [
                  { id: "prod-a1", title: "Linen Sofa", supplier: "Urban Craft", price: 42000, leadTimeDays: 25 },
                  { id: "prod-a2", title: "Velvet Sofa", supplier: "Forma", price: 47000, leadTimeDays: 35 }
                ]
              },
              {
                id: "obj-a2",
                name: "Center Table",
                category: "Furniture",
                quantity: 1,
                productOptions: [
                  { id: "prod-a3", title: "Travertine Table", supplier: "Stone Lab", price: 28000, leadTimeDays: 30 },
                  { id: "prod-a4", title: "Walnut Table", supplier: "Madera", price: 19000, leadTimeDays: 20 }
                ]
              }
            ]
          },
          {
            id: "room-a1-2",
            houseId: "house-a1",
            name: "Master Bedroom",
            objects: [
              {
                id: "obj-a3",
                name: "Bed Frame",
                category: "Furniture",
                quantity: 1,
                productOptions: [
                  { id: "prod-a5", title: "Oak Bed", supplier: "Madera", price: 36000, leadTimeDays: 32 }
                ]
              }
            ]
          }
        ]
      },
      {
        id: "house-a2",
        projectId: "project-a",
        name: "House 02",
        rooms: [
          {
            id: "room-a2-1",
            houseId: "house-a2",
            name: "Kitchen",
            objects: [
              {
                id: "obj-a4",
                name: "Countertop",
                category: "Surface",
                quantity: 1,
                productOptions: [
                  { id: "prod-a6", title: "Quartz White", supplier: "Stone Lab", price: 52000, leadTimeDays: 21 }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: "project-b",
    name: "Dune Villas",
    customer: "Ari Development",
    houses: [
      {
        id: "house-b1",
        projectId: "project-b",
        name: "Villa A",
        rooms: [
          {
            id: "room-b1-1",
            houseId: "house-b1",
            name: "Guest Suite",
            objects: [
              {
                id: "obj-b1",
                name: "Wardrobe",
                category: "Joinery",
                quantity: 1,
                productOptions: [
                  { id: "prod-b1", title: "Oak Veneer Wardrobe", supplier: "Join Studio", price: 31000, leadTimeDays: 28 }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
];

export function getProjectById(projectId: string): Project | undefined {
  return mockProjects.find((project) => project.id === projectId);
}
