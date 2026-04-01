import { z } from "zod";
import { jsonError } from "@/lib/http";
import { createReceiptPdf, deleteReceiptPdf, getCurrentProfile, issueReceiptNumber, uploadReceiptPdf } from "@/lib/server-utils";
import { formatCurrency, formatDate } from "@/lib/format";

const transferSchema = z.object({
  from_collector_id: z.string().uuid(),
  to_collector_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  transfer_date: z.string().date(),
  note: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  let uploadedReceiptPath: string | null = null;

  try {
    const payload = transferSchema.parse(await request.json());
    const { supabase, profile } = await getCurrentProfile();

    const [fromRes, toRes] = await Promise.all([
      supabase.from("collectors").select("id, name, madrasa_id").eq("id", payload.from_collector_id).single(),
      supabase.from("collectors").select("id, name, madrasa_id").eq("id", payload.to_collector_id).single(),
    ]);

    if (fromRes.error || !fromRes.data) {
      return jsonError(fromRes.error?.message || "Sender collector not found", 404);
    }

    if (toRes.error || !toRes.data) {
      return jsonError(toRes.error?.message || "Receiver collector not found", 404);
    }

    if (fromRes.data.madrasa_id !== profile.madrasa_id || toRes.data.madrasa_id !== profile.madrasa_id) {
      return jsonError("Unauthorized", 403);
    }

    const transferNo = await issueReceiptNumber({
      sequenceType: "collector_transfer",
      prefix: "TRF",
    });

    const pdfBytes = await createReceiptPdf({
      title: "Collector Transfer Receipt",
      referenceNo: transferNo,
      subtitle: profile.full_name,
      lines: [
        { label: "From", value: fromRes.data.name || "—" },
        { label: "To", value: toRes.data.name || "—" },
        { label: "Amount", value: formatCurrency(Number(payload.amount)) },
        { label: "Date", value: formatDate(payload.transfer_date) },
        { label: "Note", value: payload.note || "—" },
      ],
    });

    uploadedReceiptPath = await uploadReceiptPdf({
      madrasaId: profile.madrasa_id,
      entityType: "transfers",
      referenceNo: transferNo,
      bytes: pdfBytes,
    });

    const { data, error } = await supabase.rpc("transfer_collector_balance_entry", {
      p_from_collector_id: payload.from_collector_id,
      p_to_collector_id: payload.to_collector_id,
      p_amount: payload.amount,
      p_transfer_date: payload.transfer_date,
      p_note: payload.note || null,
      p_transfer_no: transferNo,
      p_receipt_pdf_path: uploadedReceiptPath,
    });

    if (error || !data) {
      if (uploadedReceiptPath) {
        await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
      }
      return jsonError(error?.message || "Failed to transfer balance");
    }

    return Response.json({ data });
  } catch (error) {
    if (uploadedReceiptPath) {
      await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to transfer balance");
  }
}
