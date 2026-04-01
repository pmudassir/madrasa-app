import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

const familyMemberSchema = z.object({
  name: z.string().trim().optional().default(""),
  relation: z.string().trim().optional().default(""),
  age: z.number().int().min(0).nullable().optional(),
  phone_no: z.string().trim().optional().nullable(),
  status: z.enum(["working", "studying", "none"]).default("none"),
  class_or_work_details: z.string().trim().optional().nullable(),
});

const familySchema = z.object({
  id: z.string().uuid().optional().nullable(),
  head_name: z.string().trim().min(1, "Head name is required"),
  phone_no: z.string().trim().optional().nullable(),
  whatsapp_no: z.string().trim().optional().nullable(),
  job: z.string().trim().optional().nullable(),
  financial_grade: z.enum(["A", "B", "C", "D"]),
  address: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  members: z.array(familyMemberSchema).default([]),
});

async function saveFamily(request: Request) {
  try {
    const payload = familySchema.parse(await request.json());
    const { supabase } = await getCurrentProfile();

    const { data, error } = await supabase.rpc("save_family_entry", {
      p_family_id: payload.id || null,
      p_head_name: payload.head_name,
      p_phone_no: payload.phone_no || null,
      p_whatsapp_no: payload.whatsapp_no || null,
      p_job: payload.job || null,
      p_financial_grade: payload.financial_grade,
      p_address: payload.address || null,
      p_notes: payload.notes || null,
      p_members: payload.members,
    });

    if (error) {
      return jsonError(error.message);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to save family");
  }
}

export async function POST(request: Request) {
  return saveFamily(request);
}

export async function PUT(request: Request) {
  return saveFamily(request);
}
