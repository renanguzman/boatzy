// Types para o Boatzy Marketplace

export type BoatType = 'yacht' | 'speedboat' | 'jetski' | 'sailboat' | 'catamaran';

export interface Boat {
  id: string;
  ownerId: string;
  name: string;
  type: BoatType;
  capacity: number;
  location: string;
  pricePerDay: number;
  description: string;
  images: string[];
  rating: number;
  reviewCount: number;
  length?: number;
  cabins?: number;
  crew?: number;
  badges?: string[];
  createdAt: string;
}

export type UserRoleType = 'admin' | 'gestor' | 'cliente';

export interface User {
  id: string;
  id_clerk: string;
  name: string;
  email: string;
  cpf_cnpj: string | null;
  birthday: string | null;
  avatar_url: string | null;
  roles: UserRoleType[];
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: UserRoleType;
  created_at: string;
}

export interface Reservation {
  id: string;
  boatId: string;
  userId: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  totalPrice: number;
  createdAt: string;
}

export interface Review {
  id: string;
  boatId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Package {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
}
