export interface Madrasa {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  madrasa_id: string;
  full_name: string;
  role: "admin" | "staff";
  created_at: string;
}

export interface Student {
  id: string;
  madrasa_id: string;
  name: string;
  class: string | null;
  date_of_birth: string | null;
  gender: "male" | "female" | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  address: string | null;
  joined_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Teacher {
  id: string;
  madrasa_id: string;
  name: string;
  subject: string | null;
  phone: string | null;
  monthly_salary: number;
  joined_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MadrasaEvent {
  id: string;
  madrasa_id: string;
  title: string;
  description: string | null;
  event_date: string;
  created_at: string;
  total_donations?: number;
}

export interface Donation {
  id: string;
  event_id: string;
  madrasa_id: string;
  donor_name: string | null;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  madrasa_id: string;
  category: "maintenance" | "electricity" | "water" | "supplies" | "transport" | "food" | "other";
  description: string | null;
  amount: number;
  expense_date: string;
  created_at: string;
}

export interface SalaryPayment {
  id: string;
  teacher_id: string;
  madrasa_id: string;
  amount: number;
  month: number;
  year: number;
  paid_at: string;
  notes: string | null;
  created_at: string;
  teacher?: Teacher;
}

export interface FeePayment {
  id: string;
  madrasa_id: string;
  student_id: string;
  description: string;
  amount: number;
  status: "paid" | "pending";
  fee_date: string;
  created_at: string;
}

export const EXPENSE_CATEGORIES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "supplies", label: "Supplies" },
  { value: "transport", label: "Transport" },
  { value: "food", label: "Food" },
  { value: "other", label: "Other" },
] as const;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
