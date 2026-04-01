import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getCurrentProfile } from "@/lib/server-utils";

const expenseSchema = z.object({
  category: z.enum(["maintenance", "electricity", "water", "supplies", "transport", "food", "other"]),
  description: z.string().trim().optional().nullable(),
  amount: z.coerce.number().positive(),
  expense_date: z.string().date(),
  paid_by_collector_id: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    const payload = expenseSchema.parse(await request.json());
    const { supabase } = await getCurrentProfile();

    const { data, error } = await supabase.rpc("record_expense_entry", {
      p_category: payload.category,
      p_description: payload.description || null,
      p_amount: payload.amount,
      p_expense_date: payload.expense_date,
      p_paid_by: payload.paid_by_collector_id,
    });

    if (error) {
      return jsonError(error.message);
    }

    return Response.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to record expense");
  }
}
