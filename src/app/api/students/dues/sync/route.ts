import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

const syncSchema = z.object({
  through_year: z.coerce.number().int().min(2000),
  through_month: z.coerce.number().int().min(1).max(12),
});

export async function POST(request: Request) {
  try {
    const payload = syncSchema.parse(await request.json());
    const { supabase, profile } = await getCurrentProfile();

    const { data, error } = await supabase.rpc("sync_madrasa_fee_dues", {
      p_madrasa_id: profile.madrasa_id,
      p_through_year: payload.through_year,
      p_through_month: payload.through_month,
    });

    if (error) {
      return jsonError(error.message);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to sync dues");
  }
}
