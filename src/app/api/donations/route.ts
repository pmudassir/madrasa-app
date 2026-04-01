import { z } from "zod";
import { jsonError } from "@/lib/http";
import { createReceiptPdf, deleteReceiptPdf, getCurrentProfile, issueReceiptNumber, uploadReceiptPdf } from "@/lib/server-utils";
import { formatCurrency, formatDate } from "@/lib/format";

const donationSchema = z.object({
  event_id: z.string().uuid(),
  donor_name: z.string().trim().optional().nullable(),
  amount: z.coerce.number().positive(),
  notes: z.string().trim().optional().nullable(),
  status: z.enum(["offered", "collected"]),
  collected_by_collector_id: z.string().uuid().optional().nullable(),
  effective_date: z.string().date(),
});

export async function POST(request: Request) {
  let uploadedReceiptPath: string | null = null;

  try {
    const payload = donationSchema.parse(await request.json());
    const { supabase, profile } = await getCurrentProfile();

    let receiptNo: string | null = null;

    if (payload.status === "collected") {
      const [eventRes, collectorRes] = await Promise.all([
        supabase.from("events").select("id, title, madrasa_id").eq("id", payload.event_id).single(),
        supabase.from("collectors").select("id, name, madrasa_id").eq("id", payload.collected_by_collector_id).single(),
      ]);

      if (eventRes.error || !eventRes.data) {
        return jsonError(eventRes.error?.message || "Event not found", 404);
      }

      if (collectorRes.error || !collectorRes.data) {
        return jsonError(collectorRes.error?.message || "Collector not found", 404);
      }

      if (eventRes.data.madrasa_id !== profile.madrasa_id || collectorRes.data.madrasa_id !== profile.madrasa_id) {
        return jsonError("Unauthorized", 403);
      }

      receiptNo = await issueReceiptNumber({
        sequenceType: "donation_receipt",
        prefix: "DON",
      });

      const pdfBytes = await createReceiptPdf({
        title: "Donation Receipt",
        referenceNo: receiptNo,
        subtitle: profile.full_name,
        lines: [
          { label: "Event", value: eventRes.data.title || "—" },
          { label: "Donor", value: payload.donor_name || "Anonymous" },
          { label: "Collected By", value: collectorRes.data.name || "—" },
          { label: "Collected On", value: formatDate(payload.effective_date) },
          { label: "Amount", value: formatCurrency(Number(payload.amount)) },
          { label: "Notes", value: payload.notes || "—" },
        ],
      });

      uploadedReceiptPath = await uploadReceiptPdf({
        madrasaId: profile.madrasa_id,
        entityType: "donations",
        referenceNo: receiptNo,
        bytes: pdfBytes,
      });
    }

    const { data, error } = await supabase.rpc("create_donation_entry", {
      p_event_id: payload.event_id,
      p_donor_name: payload.donor_name || null,
      p_amount: payload.amount,
      p_notes: payload.notes || null,
      p_status: payload.status,
      p_collected_by: payload.status === "collected" ? payload.collected_by_collector_id || null : null,
      p_effective_date: payload.effective_date,
      p_receipt_no: receiptNo,
      p_receipt_pdf_path: uploadedReceiptPath,
    });

    if (error || !data) {
      if (uploadedReceiptPath) {
        await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
      }
      return jsonError(error?.message || "Failed to save donation");
    }

    return Response.json({ data });
  } catch (error) {
    if (uploadedReceiptPath) {
      await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to save donation");
  }
}
