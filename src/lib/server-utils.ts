import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (error || !profile) {
    throw new Error("Profile not found");
  }

  return { supabase, user, profile };
}

export async function createReceiptPdf(options: {
  title: string;
  referenceNo: string;
  subtitle?: string;
  lines: Array<{ label: string; value: string }>;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = height - 72;

  page.drawText("Madrasa Manager", {
    x: 50,
    y,
    size: 20,
    font: bold,
    color: rgb(0.12, 0.16, 0.23),
  });
  y -= 28;

  page.drawText(options.title, {
    x: 50,
    y,
    size: 18,
    font: bold,
    color: rgb(0, 0.78, 0.33),
  });
  y -= 20;

  if (options.subtitle) {
    page.drawText(options.subtitle, {
      x: 50,
      y,
      size: 11,
      font,
      color: rgb(0.39, 0.45, 0.55),
    });
    y -= 24;
  }

  page.drawRectangle({
    x: 50,
    y: y - 12,
    width: width - 100,
    height: 26,
    color: rgb(0.91, 0.98, 0.94),
  });
  page.drawText(`Reference: ${options.referenceNo}`, {
    x: 60,
    y: y - 2,
    size: 12,
    font: bold,
    color: rgb(0.12, 0.16, 0.23),
  });
  y -= 42;

  for (const line of options.lines) {
    page.drawText(line.label, {
      x: 50,
      y,
      size: 11,
      font: bold,
      color: rgb(0.39, 0.45, 0.55),
    });
    page.drawText(line.value || "—", {
      x: 210,
      y,
      size: 11,
      font,
      color: rgb(0.12, 0.16, 0.23),
    });
    y -= 22;
  }

  page.drawText("Generated automatically by Madrasa Manager", {
    x: 50,
    y: 40,
    size: 10,
    font,
    color: rgb(0.39, 0.45, 0.55),
  });

  return pdf.save();
}

export async function uploadReceiptPdf(params: {
  madrasaId: string;
  entityType: string;
  referenceNo: string;
  bytes: Uint8Array;
}) {
  const supabase = await createClient();
  const sanitizedRef = params.referenceNo.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const path = `${params.madrasaId}/${params.entityType}/${sanitizedRef}.pdf`;

  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, params.bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function deleteReceiptPdf(path: string) {
  const supabase = await createClient();
  const { error } = await supabase.storage.from("receipts").remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function issueReceiptNumber(params: {
  sequenceType: "fee_receipt" | "donation_receipt" | "collector_transfer";
  prefix: "FEE" | "DON" | "TRF";
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_receipt_number", {
    p_sequence_type: params.sequenceType,
    p_prefix: params.prefix,
  });

  if (error || !data?.receipt_no) {
    throw new Error(error?.message || "Failed to issue receipt number");
  }

  return data.receipt_no as string;
}
