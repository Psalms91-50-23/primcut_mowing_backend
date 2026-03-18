import supabase from "../config/db.js";

export const backfillJobAmountsFromQuotes = async (req, res) => {
  try {
    const { dryRun } = req.query;
    const isDryRun = String(dryRun || "").toLowerCase() === "true";

    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(`
        id,
        uuid,
        quote_uuid,
        subtotal_amount,
        gst_amount,
        total_amount,
        quote:quotes!jobs_quote_fk (
          uuid,
          subtotal_amount,
          gst_amount,
          total_amount
        )
      `)
      .eq("is_deleted", false)
      .or("subtotal_amount.is.null,gst_amount.is.null,total_amount.is.null");

    if (jobsError) {
      throw jobsError;
    }

    const rows = jobs || [];

    const updates = [];
    const skipped = [];

    for (const job of rows) {
      const quote = Array.isArray(job.quote) ? job.quote[0] : job.quote;

      if (!quote) {
        skipped.push({
          job_uuid: job.uuid,
          reason: "Quote not found for job.quote_uuid",
        });
        continue;
      }

      const nextSubtotal =
        job.subtotal_amount == null ? quote.subtotal_amount : job.subtotal_amount;

      const nextGst =
        job.gst_amount == null ? quote.gst_amount : job.gst_amount;

      const nextTotal =
        job.total_amount == null ? quote.total_amount : job.total_amount;

      const needsUpdate =
        nextSubtotal !== job.subtotal_amount ||
        nextGst !== job.gst_amount ||
        nextTotal !== job.total_amount;

      if (!needsUpdate) {
        skipped.push({
          job_uuid: job.uuid,
          reason: "Nothing to update",
        });
        continue;
      }

      updates.push({
        id: job.id,
        job_uuid: job.uuid,
        quote_uuid: job.quote_uuid,
        subtotal_amount: nextSubtotal,
        gst_amount: nextGst,
        total_amount: nextTotal,
      });
    }

    if (isDryRun) {
      return res.status(200).json({
        message: "Dry run completed",
        dry_run: true,
        total_jobs_scanned: rows.length,
        total_updates_needed: updates.length,
        total_skipped: skipped.length,
        updates,
        skipped,
      });
    }

    const updated = [];
    const failed = [];

    for (const item of updates) {
      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          subtotal_amount: item.subtotal_amount,
          gst_amount: item.gst_amount,
          total_amount: item.total_amount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) {
        failed.push({
          job_uuid: item.job_uuid,
          quote_uuid: item.quote_uuid,
          error: updateError.message,
        });
        continue;
      }

      updated.push({
        job_uuid: item.job_uuid,
        quote_uuid: item.quote_uuid,
        subtotal_amount: item.subtotal_amount,
        gst_amount: item.gst_amount,
        total_amount: item.total_amount,
      });
    }

    return res.status(200).json({
      message: "Job amounts backfill completed",
      dry_run: false,
      total_jobs_scanned: rows.length,
      total_updates_attempted: updates.length,
      total_updated: updated.length,
      total_failed: failed.length,
      total_skipped: skipped.length,
      updated,
      failed,
      skipped,
    });
  } catch (error) {
    console.error("backfillJobAmountsFromQuotes error:", error);
    return res.status(500).json({
      error: error.message || "Failed to backfill job amounts from quotes",
    });
  }
};