import { z } from "zod";
import { jsonError } from "@/lib/http";
import { createReceiptPdf, deleteReceiptPdf, getCurrentProfile, issueReceiptNumber, uploadReceiptPdf } from "@/lib/server-utils";
import { formatCurrency, formatDate, getMonthLabel } from "@/lib/format";

const feeSchema = z.object({
  due_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  collected_by_collector_id: z.string().uuid(),
  collected_at: z.string().date(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let uploadedReceiptPath: string | null = null;

  try {
    const payload = feeSchema.parse(await request.json());
    const { id } = await context.params;
    const { supabase, profile } = await getCurrentProfile();

    const [studentRes, dueRes, collectorRes] = await Promise.all([
      supabase.from("students").select("id, name, admission_no, madrasa_id").eq("id", id).single(),
      supabase
        .from("student_fee_dues")
        .select("id, student_id, fee_type, due_month, due_year, outstanding_amount")
        .eq("id", payload.due_id)
        .single(),
      supabase.from("collectors").select("id, name, madrasa_id").eq("id", payload.collected_by_collector_id).single(),
    ]);

    if (studentRes.error || !studentRes.data) {
      return jsonError(studentRes.error?.message || "Student not found", 404);
    }

    if (dueRes.error || !dueRes.data) {
      return jsonError(dueRes.error?.message || "Fee due not found", 404);
    }

    if (collectorRes.error || !collectorRes.data) {
      return jsonError(collectorRes.error?.message || "Collector not found", 404);
    }

    const student = studentRes.data;
    const due = dueRes.data;
    const collector = collectorRes.data;

    if (student.madrasa_id !== profile.madrasa_id || collector.madrasa_id !== profile.madrasa_id || due.student_id !== student.id) {
      return jsonError("Unauthorized", 403);
    }

    const receiptNo = await issueReceiptNumber({
      sequenceType: "fee_receipt",
      prefix: "FEE",
    });

    const pdfBytes = await createReceiptPdf({
      title: "Fee Receipt",
      referenceNo: receiptNo,
      subtitle: profile.full_name,
      lines: [
        { label: "Student", value: student.name || "—" },
        { label: "Admission No.", value: student.admission_no || "—" },
        { label: "Fee Type", value: due.fee_type === "admission" ? "Admission Fee" : "Monthly Fee" },
        {
          label: "Billing Period",
          value: due.fee_type === "monthly" ? `${getMonthLabel(due.due_month)} ${due.due_year ?? ""}`.trim() : "One time",
        },
        { label: "Collected By", value: collector.name || "—" },
        { label: "Collected On", value: formatDate(payload.collected_at) },
        { label: "Amount", value: formatCurrency(Number(payload.amount)) },
      ],
    });

    uploadedReceiptPath = await uploadReceiptPdf({
      madrasaId: profile.madrasa_id,
      entityType: "fees",
      referenceNo: receiptNo,
      bytes: pdfBytes,
    });

    const { data, error } = await supabase.rpc("record_fee_payment_entry", {
      p_student_id: id,
      p_due_id: payload.due_id,
      p_amount: payload.amount,
      p_collected_by: payload.collected_by_collector_id,
      p_collected_at: payload.collected_at,
      p_receipt_no: receiptNo,
      p_receipt_pdf_path: uploadedReceiptPath,
    });

    if (error || !data) {
      if (uploadedReceiptPath) {
        await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
      }
      return jsonError(error?.message || "Failed to record fee payment");
    }

    return Response.json({ data });
  } catch (error) {
    if (uploadedReceiptPath) {
      await deleteReceiptPdf(uploadedReceiptPath).catch(() => undefined);
    }
    return jsonError(error instanceof Error ? error.message : "Failed to record fee payment");
  }
}
