export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string;
  phone: string;
  hours: string;
  status: "active" | "inactive";
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  branch: string;
  phone: string;
}

export interface Consultation {
  id: number;
  name: string;
  phone: string;
  branch: string;
  reservation_date: string;
  reservation_time: string;
  goal: string;
  message: string;
  created_at: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface StatsData {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}
