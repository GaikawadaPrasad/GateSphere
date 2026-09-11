export interface Community {
  id: string;
  name: string;
  code: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  is_active: boolean;
  total_units?: number;
  total_towers?: number;
  total_residents?: number;
  created_at: string;
  updated_at?: string;
}

export interface Tower {
  id: string;
  community_id: string;
  name: string;
  code?: string;
  total_floors: number;
  total_units?: number;
  created_at: string;
}

export interface Floor {
  id: string;
  tower_id: string;
  floor_number: number;
  total_units?: number;
  created_at: string;
}

export interface Unit {
  id: string;
  floor_id: string;
  tower_id?: string;
  unit_number: string;
  unit_type?: string;
  bedrooms?: number;
  sq_ft?: number;
  area_sqft?: number;
  is_occupied?: boolean;
  created_at: string;
}

export interface Gate {
  id: string;
  community_id: string;
  name: string;
  code: string;
  gate_type: "entry" | "exit" | "both" | "pedestrian";
  is_active: boolean;
  created_at: string;
}

export interface TowerCreate {
  name: string;
  code: string;
  structure_type?: string;
  total_floors?: number;
}

export interface FloorCreate {
  tower_id: string;
  floor_number: number;
  label?: string;
}

export interface UnitCreate {
  floor_id: string;
  unit_number: string;
  unit_type?: string;
  bedrooms?: number;
  area_sqft?: number;
}
