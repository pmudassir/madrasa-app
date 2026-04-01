import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

const collectorSchema = z.object({
  name: z.string().trim().min(1, "Collector name is required"),
  phone: z.string().trim().optional().nullable(),
  whatsapp_no: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  opening_balance: z.coerce.number().min(0).default(0),
});

export async function POST(request: Request) {
  try {
    const payload = collectorSchema.parse(await request.json());
    const { supabase } = await getCurrentProfile();

    const { data, error } = await supabase.rpc("create_collector_entry", {
      p_name: payload.name,
      p_phone: payload.phone || null,
      p_whatsapp_no: payload.whatsapp_no || null,
      p_notes: payload.notes || null,
      p_opening_balance: payload.opening_balance,
    });

    if (error) {
      return jsonError(error.message);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create collector");
  }
}
