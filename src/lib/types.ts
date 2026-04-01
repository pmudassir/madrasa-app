export type ProfileRole = "admin" | "staff";
export type ClassLevel = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "+1" | "+2";
export type Gender = "male" | "female";
export type DonationStatus = "offered" | "collected";
export type FeeType = "admission" | "monthly";
export type FeeDueStatus = "pending" | "partial" | "paid";
export type FamilyGrade = "A" | "B" | "C" | "D";
export type FamilyMemberStatus = "working" | "studying" | "none";
export type LedgerMovementType =
  | "fee_collection"
  | "donation_collection"
  | "expense"
  | "transfer_in"
  | "transfer_out";
export type ExpenseCategory =
  | "maintenance"
  | "electricity"
  | "water"
  | "supplies"
  | "transport"
  | "food"
  | "other";

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
  role: ProfileRole;
  created_at: string;
}

export interface Student {
  id: string;
  madrasa_id: string;
  name: string;
  class: string | null;
  class_level: ClassLevel | string | null;
  admission_no: string | null;
  admission_date: string | null;
  admission_fee: number;
  monthly_fee: number;
  date_of_birth: string | null;
  gender: Gender | null;
  father_name: string | null;
  mother_name: string | null;
  phone_no: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
  address: string | null;
  joined_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StudentFeeDue {
  id: string;
  madrasa_id: string;
  student_id: string;
  fee_type: FeeType;
  due_month: number | null;
  due_year: number | null;
  due_amount: number;
  collected_amount: number;
  outstanding_amount: number;
  status: FeeDueStatus;
  created_at: string;
  updated_at: string;
}

export interface Collector {
  id: string;
  madrasa_id: string;
  name: string;
  phone: string | null;
  whatsapp_no: string | null;
  notes: string | null;
  opening_balance: number;
  current_balance: number;
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
  host: string | null;
  scholar_name: string | null;
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
  status: DonationStatus;
  collected_by_collector_id: string | null;
  receipt_no: string | null;
  receipt_pdf_path: string | null;
  offered_at: string | null;
  collected_at: string | null;
  created_at: string;
  collectors?: Pick<Collector, "id" | "name"> | null;
  events?: Pick<MadrasaEvent, "id" | "title" | "host" | "scholar_name"> | null;
}

export interface Expense {
  id: string;
  madrasa_id: string;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  expense_date: string;
  paid_by_collector_id: string | null;
  created_at: string;
  collectors?: Pick<Collector, "id" | "name"> | null;
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
  teachers?: Teacher | null;
}

export interface FeePayment {
  id: string;
  madrasa_id: string;
  student_id: string;
  due_id: string | null;
  description: string;
  amount: number;
  status: "paid" | "pending";
  fee_date: string;
  billing_month: number | null;
  billing_year: number | null;
  fee_type: FeeType | null;
  collected_by_collector_id: string | null;
  receipt_no: string | null;
  receipt_pdf_path: string | null;
  collected_at: string | null;
  created_at: string;
  collectors?: Pick<Collector, "id" | "name"> | null;
  students?: Pick<Student, "id" | "name" | "admission_no" | "class_level"> | null;
}

export interface CollectorTransfer {
  id: string;
  madrasa_id: string;
  transfer_no: string;
  from_collector_id: string;
  to_collector_id: string;
  amount: number;
  transfer_date: string;
  note: string | null;
  receipt_pdf_path: string | null;
  created_at: string;
  from_collectors?: Pick<Collector, "id" | "name"> | null;
  to_collectors?: Pick<Collector, "id" | "name"> | null;
}

export interface CollectorLedgerEntry {
  id: string;
  madrasa_id: string;
  collector_id: string;
  movement_type: LedgerMovementType;
  source_module: string;
  source_id: string;
  entry_date: string | null;
  amount_delta: number;
  reference_no: string | null;
  counterparty_name: string | null;
  description: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  madrasa_id: string;
  head_name: string;
  phone_no: string | null;
  whatsapp_no: string | null;
  job: string | null;
  financial_grade: FamilyGrade;
  address: string | null;
  notes: string | null;
  created_at: string;
  family_members?: FamilyMember[];
}

export interface FamilyMember {
  id: string;
  family_id: string;
  name: string;
  relation: string;
  age: number | null;
  phone_no: string | null;
  status: FamilyMemberStatus;
  class_or_work_details: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  madrasa_id: string;
  user_name: string;
  category: "students" | "teachers" | "financial" | "events" | "settings" | "system";
  description: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
}

export const CLASS_LEVELS: ClassLevel[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "+1", "+2"];

export const EXPENSE_CATEGORIES = [
  { value: "maintenance", label: "Maintenance" },
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "supplies", label: "Supplies" },
  { value: "transport", label: "Transport" },
  { value: "food", label: "Food" },
  { value: "other", label: "Other" },
] as const;

export const FAMILY_GRADES: FamilyGrade[] = ["A", "B", "C", "D"];
export const FAMILY_MEMBER_STATUSES: FamilyMemberStatus[] = ["working", "studying", "none"];

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
