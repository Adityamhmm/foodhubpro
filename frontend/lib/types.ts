export type MenuItem = {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  description?: string | null;
  imageUrl?: string | null;
  foodType?: string | null;
  price: number;
  available: boolean;
  tags: string[];
};

export type OrderItem = {
  id?: number;
  menuItemId?: string | null;
  name: string;
  category?: string | null;
  foodType?: string | null;
  price: number;
  quantity: number;
  chefNote?: string | null;
};

export type Order = {
  id: string;
  table: number;
  total: number;
  status: "Pending" | "Accepted" | "Denied" | "Completed" | string;
  chefNote?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  completedAt?: string | null;
  items: OrderItem[];
};

export type Staff = {
  username: string;
  role: "ADMIN" | "KITCHEN";
  enabled?: boolean;
};

export type RestaurantTable = {
  tableNumber: number;
  label: string;
  active: boolean;
  online?: boolean | null;
  hasCart?: boolean | null;
  billRequested?: boolean | null;
};

export type Bill = {
  id: string;
  table: number;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentMethod?: string | null;
  createdAt: string;
  paidAt?: string | null;
  items?: OrderItem[];
  taxLines?: { name: string; percent: number; amount: number }[];
};
