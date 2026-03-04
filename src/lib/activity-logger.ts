import { createClient } from "@/lib/supabase/client";

export async function logActivity(
  category: "students" | "teachers" | "financial" | "events" | "settings" | "system",
  description: string,
  entityType?: string,
  entityId?: string
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("madrasa_id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  await supabase.from("activity_log").insert({
    madrasa_id: profile.madrasa_id,
    user_name: profile.full_name,
    category,
    description,
    entity_type: entityType || null,
    entity_id: entityId || null,
  });
}
