import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

export async function GET(request: Request) {
  try {
    const { supabase, profile } = await getCurrentProfile();
    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");

    if (!path) {
      return jsonError("Receipt path is required");
    }

    if (!path.startsWith(`${profile.madrasa_id}/`)) {
      return jsonError("Unauthorized", 403);
    }

    const { data, error } = await supabase.storage.from("receipts").download(path);

    if (error || !data) {
      return jsonError(error?.message || "Receipt not found", 404);
    }

    return new Response(await data.arrayBuffer(), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.split("/").pop() || "receipt.pdf"}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to load receipt", 500);
  }
}
