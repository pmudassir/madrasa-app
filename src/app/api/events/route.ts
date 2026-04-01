import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

const eventSchema = z.object({
  title: z.string().trim().min(1, "Event title is required"),
  description: z.string().trim().optional().nullable(),
  event_date: z.string().date(),
  host: z.string().trim().optional().nullable(),
  scholar_name: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const payload = eventSchema.parse(await request.json());
    const { supabase } = await getCurrentProfile();

    const { data, error } = await supabase.rpc("create_event_entry", {
      p_title: payload.title,
      p_description: payload.description || null,
      p_event_date: payload.event_date,
      p_host: payload.host || null,
      p_scholar_name: payload.scholar_name || null,
    });

    if (error) {
      return jsonError(error.message);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to create event");
  }
}
