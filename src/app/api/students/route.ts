import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

const studentSchema = z.object({
  name: z.string().trim().min(1, "Student name is required"),
  class_level: z.enum(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "+1", "+2"]),
  admission_date: z.string().date(),
  admission_fee: z.coerce.number().min(0).default(0),
  monthly_fee: z.coerce.number().min(0).default(0),
  father_name: z.string().trim().optional().nullable(),
  mother_name: z.string().trim().optional().nullable(),
  phone_no: z.string().trim().optional().nullable(),
  date_of_birth: z.string().date().optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  address: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const payload = studentSchema.parse(await request.json());
    const { supabase } = await getCurrentProfile();

    const { data, error } = await supabase.rpc("create_student_admission_entry", {
      p_name: payload.name,
      p_class_level: payload.class_level,
      p_admission_date: payload.admission_date,
      p_admission_fee: payload.admission_fee,
      p_monthly_fee: payload.monthly_fee,
      p_father_name: payload.father_name || null,
      p_mother_name: payload.mother_name || null,
      p_phone_no: payload.phone_no || null,
      p_date_of_birth: payload.date_of_birth || null,
      p_gender: payload.gender || null,
      p_address: payload.address || null,
    });

    if (error) {
      return jsonError(error.message);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create admission");
  }
}
