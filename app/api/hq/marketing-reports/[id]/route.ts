import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

const agg = (items: any[], key: string) => {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const k = item[key];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(item);
  }
  return [...groups.entries()].map(([k, rows]) => {
    const spend = rows.reduce((s: number, r: any) => s + r.spend, 0);
    const impressions = rows.reduce((s: number, r: any) => s + r.impressions, 0);
    const clicks = rows.reduce((s: number, r: any) => s + r.effective_clicks, 0);
    const results = rows.reduce((s: number, r: any) => s + r.results, 0);
    return {
      [key]: k,
      spend,
      impressions,
      clicks,
      results,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
      cpc: clicks > 0 ? spend / clicks : null,
      cost_per_result: results > 0 ? spend / results : null,
    };
  });
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [[report]]: any = await pool.query(
      "SELECT * FROM marketing_reports WHERE id = ?",
      [id]
    );
    if (!report) return err("리포트를 찾을 수 없습니다.", 404);

    const [items]: any = await pool.query(
      "SELECT * FROM marketing_report_items WHERE report_id = ? ORDER BY id ASC",
      [id]
    );

    const byBranch = agg(items, "branch");
    const byChannel = agg(items, "channel");

    const pairsMap = new Map<string, any[]>();
    for (const item of items) {
      const k = `${item.branch}__${item.channel}`;
      if (!pairsMap.has(k)) pairsMap.set(k, []);
      pairsMap.get(k)!.push(item);
    }
    const byBranchChannel = [...pairsMap.entries()].map(([k, rows]) => {
      const [branch, channel] = k.split("__");
      const spend = rows.reduce((s: number, r: any) => s + r.spend, 0);
      const impressions = rows.reduce((s: number, r: any) => s + r.impressions, 0);
      const clicks = rows.reduce((s: number, r: any) => s + r.effective_clicks, 0);
      const results = rows.reduce((s: number, r: any) => s + r.results, 0);
      return {
        branch, channel, spend, impressions, clicks, results,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
        cost_per_result: results > 0 ? spend / results : null,
      };
    });

    const top5 = items
      .filter((r: any) => r.effective_clicks >= 10 && r.cpc > 0)
      .sort((a: any, b: any) => a.cpc - b.cpc || b.ctr - a.ctr)
      .slice(0, 5);

    const warnings = items
      .filter((r: any) => r.judgement === "WARNING")
      .sort((a: any, b: any) => b.spend - a.spend);

    return ok({ report, items, byBranch, byChannel, byBranchChannel, top5, warnings });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await pool.query("DELETE FROM marketing_reports WHERE id = ?", [id]);
    return ok({ deleted: true });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
