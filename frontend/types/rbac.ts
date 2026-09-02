export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system?: boolean;
  is_wildcard?: boolean;
  default_permissions?: string[];
  permissions?: string[];
}

export interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description?: string;
}
