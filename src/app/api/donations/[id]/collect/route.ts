import { z } from "zod";
import { jsonError } from "@/lib/http";
import { createReceiptPdf, deleteReceiptPdf, getCurrentProfile, issueReceiptNumber, uploadReceiptPdf } from "@/lib/server-utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { relationItem } from "@/lib/relation-utils";

const collectSchema = z.object({
  collected_by_collector_id: z.string().uuid(),
  collected_at: z.string().date(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let uploadedReceiptPath: string | null = null;

  try {
    const payload = collectSchema.parse(await request.json());
    const { id } = await context.params;
    const { supabase, profile } = await getCurrentProfile();

    const [donationRes, collectorRes] = await Promise.all([
      supabase
        .from("donations")
        .select("id, donor_name, amount, notes, status, madrasa_id, events(title)")
        .eq("id", id)
        .single(),
      supabase.from("collectors").select("id, name, madrasa_id").eq("id", payload.collected_by_collector_id).single(),
    ]);

    if (donationRes.error || !donationRes.data) {
      return jsonError(donationRes.error?.message || "Donation not found", 404);
    }

    if (collectorRes.error || !collectorRes.data) {
      return jsonError(collectorRes.error?.message || "Collector not found", 404);
    }

    if (donationRes.data.madrasa_id !== profile.madrasa_id || collectorRes.data.madrasa_id !== profile.madrasa_id) {
      return jsonError("Unauthorized", 403);
    }

    const donation = donationRes.data;
    const receiptNo = await issueReceiptNumber({
      sequenceType: "donation_receipt",
      prefix: "DON",
    });

    const eventTitle = relationItem(donation.events)?.title;
    const pdfBytes = await createReceiptPdf({
      title: "Donation Receipt",
      referenceNo: receiptNo,
      subtitle: profile.full_name,
      lines: [
        { label: "Event", value: eventTitle || "—" },
        { label: "Donor", value: donation.donor_name || "Anonymous" },
        { label: "Collected By", value: collectorRes.data.name || "—" },
        { label: "Collected On", value: formatDate(payload.collected_at) },
        { label: "Amount", value: formatCurrency(Number(donation.amount)) },
        { label: "Notes", value: donation.notes || "—" },
      ],
    });

    uploadedReceiptPath = await uploadReceiptPdf({
      madrasaId: profile.madrasa_id,
      entityType: "donations",
      referenceNo: receiptNo,
      bytes: pdfBytes,
    });

    const { data, error } = await supabase.rpc("collect_offered_donation_entry", {
      p_donation_id: id,
      p_collected_by: payload.collected_by_collector_id,
      p_collected_at: payload.collected_at,
      p_receipt_no: receiptNo,
      p_receipt_pdf_path: uploadedReceiptPath,
    });

    if (error || !data) {
      if (uploadedReceiptPath) {
        await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
      }
      return jsonError(error?.message || "Failed to collect donation");
    }

    return Response.json({ data });
  } catch (error) {
    if (uploadedReceiptPath) {
      await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to collect donation");
  }
}
