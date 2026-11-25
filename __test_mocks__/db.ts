// mock pool — 실제 MySQL 연결 없이 쿼리 기록
export type QueryCall = { sql: string; params: any[] };

class MockConn {
  calls: QueryCall[];
  txState: { began: boolean; committed: boolean; rolled: boolean };

  constructor(calls: QueryCall[], txState: any) {
    this.calls = calls;
    this.txState = txState;
  }

  async beginTransaction() { this.txState.began = true; }
  async commit() { this.txState.committed = true; }
  async rollback() { this.txState.rolled = true; }
  release() {}

  async query(sql: string, params?: any[]): Promise<[any, any]> {
    this.calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params: params ?? [] });
    const s = sql.toLowerCase();
    if (s.includes("insert")) return [{ insertId: 999, affectedRows: 1 }, {}];
    if (s.includes("set @sbm") || s.includes("update")) return [{ affectedRows: 1 }, {}];
    return [[], {}];
  }
}

export const poolState = {
  calls: [] as QueryCall[],
  memberRows: [] as any[],
  productRows: [] as any[],
  existing: [] as any[],
  passCheckRows: [] as any[],
  txState: { began: false, committed: false, rolled: false },
  reset() {
    this.calls = [];
    this.memberRows = [];
    this.productRows = [];
    this.existing = [];
    this.passCheckRows = [];
    this.txState = { began: false, committed: false, rolled: false };
  },
};

const pool: any = {
  async query(sql: string, params?: any[]): Promise<[any, any]> {
    poolState.calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params: params ?? [] });
    const s = sql.toLowerCase();
    if (s.includes("from payments") && s.includes("idempotency_key")) return [poolState.existing, {}];
    if (s.includes("from members")) return [poolState.memberRows, {}];
    if (s.includes("from settings_options") && s.includes("select option_id")) return [poolState.passCheckRows, {}];
    if (s.includes("from settings_options") && s.includes("select *")) return [poolState.productRows, {}];
    if (s.includes("from settings_options")) return [poolState.productRows, {}];
    if (s.includes("insert")) return [{ insertId: 999, affectedRows: 1 }, {}];
    return [[], {}];
  },
  async getConnection() {
    return new MockConn(poolState.calls, poolState.txState);
  },
};

export default pool;
