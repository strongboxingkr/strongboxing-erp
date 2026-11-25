export const ERP_SESSION_COOKIE = "erp_session";
export type ErpUser = { user_id: number; login_id: string; name: string; role: string; branch_name: string | null };
export async function getErpUser(_req: any): Promise<ErpUser> {
  return { user_id: 1, login_id: "test", name: "테스터", role: "ADMIN", branch_name: "철산점" };
}
export async function createErpSession(_userId: number) { return "mock-token"; }
export async function deleteErpSession(_req: any) {}
