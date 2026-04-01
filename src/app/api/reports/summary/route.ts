import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

export async function GET() {
  try {
    const { supabase } = await getCurrentProfile();
    const { data, error } = await supabase.rpc("get_reports_summary");

    if (error || !data) {
      return jsonError(error?.message || "Failed to load report summary", 500);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load report summary", 500);
  }
}
