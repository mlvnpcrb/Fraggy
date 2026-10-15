export type Perfume = {
  id: string;
  brand: string;
  name: string;
  sizeMl: number;
  remainingMl: number;
  kind: "full" | "partial" | "decant";
  trade: boolean;
};
export const demoPerfumes: Perfume[] = [
  {
    id: "1",
    brand: "Le Labo",
    name: "Santal 33",
    sizeMl: 100,
    remainingMl: 85,
    kind: "partial",
    trade: true,
  },
  {
    id: "2",
    brand: "Chanel",
    name: "Bleu de Chanel",
    sizeMl: 100,
    remainingMl: 100,
    kind: "full",
    trade: false,
  },
  {
    id: "3",
    brand: "Maison Francis Kurkdjian",
    name: "Baccarat Rouge 540",
    sizeMl: 10,
    remainingMl: 8,
    kind: "decant",
    trade: true,
  },
  {
    id: "4",
    brand: "Versace",
    name: "Eros",
    sizeMl: 50,
    remainingMl: 40,
    kind: "partial",
    trade: false,
  },
];
export const FREE_LIMIT = 7;
