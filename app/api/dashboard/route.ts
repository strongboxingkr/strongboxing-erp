import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, canAccessBranch } from "@/lib/auth";

const branchNames = ["철산점", "목동점", "개봉점", "신정점"];

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);

    const branch_name = searchParams.get("branch_name");
    const start_date = searchParams.get("start_date");
    const end_date = searchParams.get("end_date");

    const startDate = start_date || new Date().toISOString().slice(0, 10);
    const endDate = end_date || new Date().toISOString().slice(0, 10);

    const branchFilter = branch_name ? ` AND branch_name = ? ` : "";
    const branchParams = branch_name ? [branch_name] : [];

    const [salesRows]: any = await pool.query(
      `
      SELECT IFNULL(SUM(final_amount), 0) AS sales
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [expenseRows]: any = await pool.query(
      `
      SELECT IFNULL(SUM(amount), 0) AS expenses
      FROM expenses
      WHERE expense_date BETWEEN ? AND ?
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [paymentMethodRows]: any = await pool.query(
      `
      SELECT payment_method, IFNULL(SUM(final_amount), 0) AS amount
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
      ${branchFilter}
      GROUP BY payment_method
      `,
      [startDate, endDate, ...branchParams]
    );

    const [checkinRows]: any = await pool.query(
      `
      SELECT COUNT(DISTINCT a.member_id) AS checkins
      FROM attendance a
      LEFT JOIN members m ON a.member_id = m.member_id
      WHERE DATE(a.checkin_time) = CURDATE()
      AND a.result IN ('SUCCESS', 'CHECK_OUT')
      ${branch_name ? "AND m.branch_name = ?" : ""}
      `,
      branch_name ? [branch_name] : []
    );

    const [totalMembersRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS total_members
      FROM members
      WHERE 1=1
      ${branchFilter}
      `,
      branchParams
    );

    const [activeMembersRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS active_members
      FROM members
      WHERE status != 'REST'
      AND (
        (pass_type != 'COUNT' AND end_date >= CURDATE())
        OR (pass_type = 'COUNT' AND remaining_count > 0)
      )
      ${branchFilter}
      `,
      branchParams
    );

    const [newMembersRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS new_members
      FROM members
      WHERE DATE(created_at) BETWEEN ? AND ?
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [todayExpireRows]: any =
    await pool.query(
      `
      SELECT COUNT(*) AS today_expire
      FROM members
      WHERE status = 'ACTIVE'
      AND DATE(end_date) = CURDATE()
      ${branchFilter}
      `,
      branchParams
    );

    const [todayExpireMembers]: any =
    await pool.query(
      `
      SELECT
        member_id,
        name,
        phone,
        branch_name,
        product_name,
        end_date
      FROM members
      WHERE status = 'ACTIVE'
      AND DATE(end_date) = CURDATE()
      ${branchFilter}
      ORDER BY branch_name, name
      `,
      branchParams
    );

    const [alertMembersRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS alert_members
      FROM members
      WHERE status != 'REST'
      AND (
        (pass_type != 'COUNT' AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
        OR (pass_type = 'COUNT' AND remaining_count > 0 AND remaining_count <= 3)
      )
      ${branchFilter}
      `,
      branchParams
    );

    const [crmAlertRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS crm_alerts
      FROM crm_leads
      WHERE next_contact_date <= CURDATE()
      AND status IN ('상담중', '방문예약', '재연락필요', '보류')
      ${branchFilter}
      `,
      branchParams
    );

    const [reservationRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS reservations
      FROM naver_reservations
      WHERE reservation_date BETWEEN ? AND ?
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [reservationWaitingRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE reservation_date BETWEEN ? AND ?
      AND status = '예약접수'
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [reservationConfirmedRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE reservation_date BETWEEN ? AND ?
      AND status = '예약확정'
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [reservationDoneRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE reservation_date BETWEEN ? AND ?
      AND status = '상담완료'
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [reservationNoshowRows]: any = await pool.query(
      `
      SELECT COUNT(*) AS count
      FROM naver_reservations
      WHERE reservation_date BETWEEN ? AND ?
      AND status = '노쇼'
      ${branchFilter}
      `,
      [startDate, endDate, ...branchParams]
    );

    const [branchSalesRaw]: any = await pool.query(
      `
      SELECT branch_name, IFNULL(SUM(final_amount), 0) AS sales
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
      GROUP BY branch_name
      `,
      [startDate, endDate]
    );

    // 신규 = 이번 기간에 처음 가입한 회원 (join_date 기준, 기존 결제 없음)
    const [branchNewMembersRaw]: any = await pool.query(
      `
      SELECT branch_name, COUNT(*) AS new_members
      FROM members
      WHERE DATE(join_date) BETWEEN ? AND ?
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.member_id = members.member_id
        AND p.payment_date < ?
        AND p.final_amount > 0
      )
      GROUP BY branch_name
      `,
      [startDate, endDate, startDate]
    );

    // 재등록 = 이번 기간에 결제했지만 신규가 아닌 회원
    const [branchReregCountRaw]: any = await pool.query(
      `
      SELECT m.branch_name, COUNT(DISTINCT p.member_id) AS rereg_count
      FROM payments p
      JOIN members m ON p.member_id = m.member_id
      WHERE p.payment_date BETWEEN ? AND ?
      AND p.final_amount > 0
      AND DATE(m.join_date) < ?
      GROUP BY m.branch_name
      `,
      [startDate, endDate, startDate]
    );

    const [branchActiveMembersRaw]: any = await pool.query(
      `
      SELECT branch_name, COUNT(*) AS active_members
      FROM members
      WHERE status != 'REST'
      AND (
        (pass_type != 'COUNT' AND end_date >= CURDATE())
        OR (pass_type = 'COUNT' AND remaining_count > 0)
      )
      GROUP BY branch_name
      `
    );

    const [branchCheckinsRaw]: any = await pool.query(
      `
      SELECT m.branch_name, COUNT(DISTINCT a.member_id) AS checkins
      FROM attendance a
      LEFT JOIN members m ON a.member_id = m.member_id
      WHERE DATE(a.checkin_time) = CURDATE()
      AND a.result IN ('SUCCESS', 'CHECK_OUT')
      GROUP BY m.branch_name
      `
    );

    const [branchReservationsRaw]: any = await pool.query(
      `
      SELECT branch_name, COUNT(*) AS reservations
      FROM naver_reservations
      WHERE reservation_date BETWEEN ? AND ?
      GROUP BY branch_name
      `,
      [startDate, endDate]
    );

    const [branchCrmRaw]: any = await pool.query(
      `
      SELECT branch_name, COUNT(*) AS crm_alerts
      FROM crm_leads
      WHERE next_contact_date <= CURDATE()
      AND status IN ('상담중', '방문예약', '재연락필요', '보류')
      GROUP BY branch_name
      `
    );

    const [branchAlertRaw]: any = await pool.query(
      `
      SELECT branch_name, COUNT(*) AS alert_members
      FROM members
      WHERE status = 'ACTIVE'
      AND (
        end_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        OR (pass_type = 'COUNT' AND remaining_count <= 3)
      )
      GROUP BY branch_name
      `
    );

    // 이전 동일 기간 지점별 매출 (선택 기간 길이만큼 이전)
    const daysDiff = Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    const prevEndDate = new Date(new Date(startDate).getTime() - 86400000).toISOString().slice(0, 10);
    const prevStartDate = new Date(new Date(startDate).getTime() - (daysDiff + 1) * 86400000).toISOString().slice(0, 10);
    const compLabel = daysDiff === 0 ? "전일 대비" : daysDiff < 7 ? "전주 대비" : daysDiff < 32 ? "전달 대비" : "전기간 대비";

    const [branchPrevSalesRaw]: any = await pool.query(
      `
      SELECT branch_name, IFNULL(SUM(final_amount), 0) AS prev_sales
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
      GROUP BY branch_name
      `,
      [prevStartDate, prevEndDate]
    );

    // 이번주 만료 임박 지점별
    const [branchExpiringSoonRaw]: any = await pool.query(
      `
      SELECT branch_name, COUNT(*) AS expiring_soon
      FROM members
      WHERE status != 'REST'
      AND pass_type != 'COUNT'
      AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      GROUP BY branch_name
      `
    );

    // 재등록율: 지난달 만료 회원 중 이후 결제한 비율
    const [branchReregRaw]: any = await pool.query(
      `
      SELECT m.branch_name,
        COUNT(*) AS expired_count,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM payments p
          WHERE p.member_id = m.member_id
          AND p.payment_date > m.end_date
          AND p.final_amount > 0
        ) THEN 1 ELSE 0 END) AS reregistered_count
      FROM members m
      WHERE DATE_FORMAT(m.end_date, '%Y-%m') = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m')
      GROUP BY m.branch_name
      `
    );

    const pick = (rows: any[], branchName: string, key: string) => {
      const row = rows.find((r) => r.branch_name === branchName);
      return Number(row?.[key] || 0);
    };

    const branchSalesRows = branchNames
      .map((branchName) => {
        const prevSales = pick(branchPrevSalesRaw, branchName, "prev_sales");
        const thisSales = pick(branchSalesRaw, branchName, "sales");
        const salesGrowth = prevSales > 0
          ? Math.round(((thisSales - prevSales) / prevSales) * 100)
          : null;
        const reregRow = branchReregRaw.find((r: any) => r.branch_name === branchName);
        const expiredCount = Number(reregRow?.expired_count || 0);
        const reregisteredCount = Number(reregRow?.reregistered_count || 0);
        const reregRate = expiredCount > 0 ? Math.round((reregisteredCount / expiredCount) * 100) : null;
        return {
        branch_name: branchName,
        sales: thisSales,
        prev_sales: prevSales,
        sales_growth: salesGrowth,
        new_members: pick(branchNewMembersRaw, branchName, "new_members"),
        rereg_count: pick(branchReregCountRaw, branchName, "rereg_count"),
        active_members: pick(branchActiveMembersRaw, branchName, "active_members"),
        checkins: pick(branchCheckinsRaw, branchName, "checkins"),
        reservations: pick(branchReservationsRaw, branchName, "reservations"),
        crm_alerts: pick(branchCrmRaw, branchName, "crm_alerts"),
        expiring_soon: pick(branchExpiringSoonRaw, branchName, "expiring_soon"),
        rereg_rate: reregRate,
        alert_members: pick(branchAlertRaw, branchName, "alert_members"),
        };
      })
      .sort((a, b) => b.sales - a.sales);

    const sales = Number(salesRows[0]?.sales || 0);
    const expenses = Number(expenseRows[0]?.expenses || 0);
    const profit = sales - expenses;

    const payment_methods = {
      CARD: 0,
      CASH: 0,
      TRANSFER: 0,
    };

    paymentMethodRows.forEach((r: any) => {
      payment_methods[r.payment_method as "CARD" | "CASH" | "TRANSFER"] =
        Number(r.amount || 0);
    });

    return NextResponse.json({
      success: true,
      start_date: startDate,
      end_date: endDate,
      branch_name: branch_name || "전체",

      sales,
      expenses,
      profit,
      payment_methods,

      checkins: Number(checkinRows[0]?.checkins || 0),
      total_members: Number(totalMembersRows[0]?.total_members || 0),
      active_members: Number(activeMembersRows[0]?.active_members || 0),
      new_members: Number(newMembersRows[0]?.new_members || 0),
      alert_members: Number(alertMembersRows[0]?.alert_members || 0),
      today_expire: Number(
        todayExpireRows[0]?.today_expire || 0
      ),
      today_expire_members:  todayExpireMembers,
      crm_alerts: Number(crmAlertRows[0]?.crm_alerts || 0),
      reservations: Number(reservationRows[0]?.reservations || 0),

          reservation_waiting: Number(
      reservationWaitingRows[0]?.count || 0
    ),

    reservation_confirmed: Number(
      reservationConfirmedRows[0]?.count || 0
    ),

    reservation_done: Number(
      reservationDoneRows[0]?.count || 0
    ),

    reservation_noshow: Number(
      reservationNoshowRows[0]?.count || 0
    ),

      branch_sales: branchSalesRows,
      comparison_label: compLabel,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error });
  }
}