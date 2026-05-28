{data && (
  <>
    <div
      className="card"
      style={{
        borderRadius: 24,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0 }}>
          결제 내역
        </h2>

        <button
          className="btn"
          onClick={() => {
            window.location.href =
              `/payments?member_id=${data.member.member_id}`;
          }}
        >
          결제 등록
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {((data?.payments as any[]) || []).map(
          (p: any) => (
            <div
              key={p.payment_id}
              style={{
                background:
                  "#111827",
                borderRadius: 18,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                    }}
                  >
                    {money(
                      p.final_amount
                    )}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      color: "#888",
                      fontSize: 13,
                    }}
                  >
                    {p.product_name ||
                      "상품명 없음"}{" "}
                    /{" "}
                    {
                      p.payment_method
                    }
                  </div>
                </div>

                <div
                  style={{
                    textAlign:
                      "right",
                  }}
                >
                  <div
                    style={{
                      color: "#aaa",
                      fontSize: 13,
                    }}
                  >
                    {p.payment_date
                      ? new Date(
                          p.payment_date
                        ).toLocaleDateString()
                      : "-"}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontWeight: 700,
                      color:
                        p.history_type ===
                          "REFUND" ||
                        p.payment_status ===
                          "REFUNDED"
                          ? "#ef4444"
                          : "#22c55e",
                    }}
                  >
                    {p.history_type ===
                    "REFUND"
                      ? "환불"
                      : p.payment_status ||
                        "결제완료"}
                  </div>
                </div>
              </div>

              {(p.memo ||
                Number(
                  p.unpaid_amount ||
                    0
                ) > 0) && (
                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop:
                      "1px solid rgba(255,255,255,.06)",
                    fontSize: 13,
                    color: "#aaa",
                    whiteSpace:
                      "pre-wrap",
                  }}
                >
                  {Number(
                    p.unpaid_amount ||
                      0
                  ) > 0 && (
                    <div
                      style={{
                        color:
                          "#f59e0b",
                        marginBottom: 6,
                        fontWeight: 700,
                      }}
                    >
                      미수금{" "}
                      {money(
                        p.unpaid_amount
                      )}
                    </div>
                  )}

                  {p.memo}
                </div>
              )}
            </div>
          )
        )}

        {((data?.payments as any[]) ||
          []).length === 0 && (
          <div
            style={{
              color: "#888",
            }}
          >
            결제 내역이
            없습니다.
          </div>
        )}
      </div>
    </div>

    <div
      className="card"
      style={{
        borderRadius: 24,
        marginBottom: 18,
      }}
    >
      <h2
        style={{
          marginTop: 0,
        }}
      >
        회원 히스토리
      </h2>

      <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {(
          (data?.histories as any[]) ||
          []
        ).map((h: any) => (
          <div
            key={h.history_id}
            style={{
              background:
                "#111827",
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 17,
                  }}
                >
                  {
                    h.action_type
                  }
                </div>

                <div
                  style={{
                    marginTop: 6,
                    color: "#aaa",
                    fontSize: 13,
                  }}
                >
                  {
                    h.action_memo
                  }
                </div>
              </div>

              <div
                style={{
                  textAlign:
                    "right",
                }}
              >
                <div
                  style={{
                    color: "#888",
                    fontSize: 13,
                  }}
                >
                  {h.created_at
                    ? new Date(
                        h.created_at
                      ).toLocaleString()
                    : "-"}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    color: "#aaa",
                    fontSize: 12,
                  }}
                >
                  {
                    h.created_by
                  }
                </div>
              </div>
            </div>
          </div>
        ))}

        {(
          (data?.histories as any[]) ||
          []
        ).length === 0 && (
          <div
            style={{
              color: "#888",
            }}
          >
            회원 히스토리가
            없습니다.
          </div>
        )}
      </div>
    </div>
  </>
)}