"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const formatDate = (d: Date) => {
  const year = d.getFullYear();

  const month = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    d.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const today = formatDate(
  new Date()
);

const getMonthStart = () => {
  const d = new Date();

  d.setDate(1);

  return formatDate(d);
};

const money = (v: any) =>
  `${Number(v || 0).toLocaleString()}원`;

export default function DashboardPage() {
  const [data, setData] =
    useState<any>(null);

  const [branches, setBranches] =
    useState<any[]>([]);

  const [branch, setBranch] =
    useState("전체");

  const [startDate, setStartDate] =
    useState(getMonthStart());

  const [endDate, setEndDate] =
    useState(today);

  const [mobile, setMobile] =
    useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setMobile(
        window.innerWidth < 900
      );
    };

    checkMobile();

    window.addEventListener(
      "resize",
      checkMobile
    );

    return () => {
      window.removeEventListener(
        "resize",
        checkMobile
      );
    };
  }, []);

  const loadBranches =
    async () => {
      const res = await apiFetch(
        "/api/settings?option_type=BRANCH"
      );

      const json =
        await res.json();

      setBranches(
        json.rows || []
      );
    };

  const loadDashboard =
    async () => {
      let url = `/api/dashboard?start_date=${startDate}&end_date=${endDate}`;

      if (branch !== "전체") {
        url += `&branch_name=${encodeURIComponent(
          branch
        )}`;
      }

      const res = await apiFetch(
        url
      );

      const json =
        await res.json();

      setData(json);
    };

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [
    branch,
    startDate,
    endDate,
  ]);

  if (!data) {
    return (
      <AppShell title="대표 대시보드">
        로딩중...
      </AppShell>
    );
  }

  const paymentMethods =
    data.payment_methods || {};

  const branchSales =
    data.branch_sales || [];

  const cards = [
    {
      title: "총 매출",
      value: money(
        data.sales || 0
      ),
      color: "#2ee59d",
      bg: "rgba(46,229,157,0.16)",
    },
    {
      title: "신규회원",
      value: `${
        data.new_members || 0
      }명`,
      color: "#5da9ff",
      bg: "rgba(93,169,255,0.16)",
    },
    {
      title: "출석",
      value: `${
        data.checkins || 0
      }명`,
      color: "#a78bfa",
      bg: "rgba(167,139,250,0.16)",
    },
    {
      title: "재연락 상담",
      value: `${
        data.crm_alerts || 0
      }건`,
      color: "#ff4d6d",
      bg: "rgba(255,77,109,0.16)",
    },
    {
    title: "오늘 만료",
    value: `${
      data.today_expire || 0
    }명`,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.16)",
  },
  ];

  return (
    <AppShell title="대표 대시보드">
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 38,
              fontWeight: 900,
            }}
          >
            대표 대시보드
          </h1>

          <p
            style={{
              color: "#888",
              marginTop: 8,
            }}
          >
            전체 운영 현황과
            매출 흐름을
            확인합니다.
          </p>
        </div>

        <button
          className="btn secondary"
          onClick={loadDashboard}
        >
          새로고침
        </button>
      </div>

      <div
        className="card"
        style={{
          marginBottom: 18,
          borderRadius: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              mobile
                ? "1fr"
                : "180px 180px 180px auto",
            gap: 12,
          }}
        >
          <select
            className="input"
            value={branch}
            onChange={(e) =>
              setBranch(
                e.target.value
              )
            }
          >
            <option>전체</option>

            {branches.map((b) => (
              <option
                key={b.option_id}
              >
                {
                  b.option_name
                }
              </option>
            ))}
          </select>

          <input
            className="input"
            type="date"
            value={startDate}
            onChange={(e) =>
              setStartDate(
                e.target.value
              )
            }
          />

          <input
            className="input"
            type="date"
            value={endDate}
            onChange={(e) =>
              setEndDate(
                e.target.value
              )
            }
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              color: "#888",
              fontWeight: 700,
            }}
          >
            {branch} /{" "}
            {startDate} ~{" "}
            {endDate}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            mobile
              ? "1fr"
              : "repeat(5, 1fr)",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {cards.map((c) => (
          <div
            key={c.title}
            className="card"
            style={{
              borderRadius: 24,
              background: `linear-gradient(135deg, ${c.bg}, var(--panel2))`,
            }}
          >
            <div
              style={{
                color: "#aaa",
                fontSize: 15,
              }}
            >
              {c.title}
            </div>

            <div
              style={{
                marginTop: 12,
                fontSize: 40,
                fontWeight: 900,
                color: c.color,
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      {branch === "전체" && (
        <div
          className="card"
          style={{
            borderRadius: 24,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              marginBottom: 16,
              alignItems: "center",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 28,
              }}
            >
              지점별 현황
            </h2>

            <div
              style={{
                color: "#888",
              }}
            >
              총{" "}
              {
                branchSales.length
              }
              개 지점
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                mobile
                  ? "1fr"
                  : "repeat(4, 1fr)",
              gap: 14,
            }}
          >
            {branchSales.map(
              (
                b: any,
                idx: number
              ) => (
                <div
                  key={
                    b.branch_name
                  }
                  style={{
                    background:
                      "var(--panel2)",
                    borderRadius: 24,
                    padding: 18,
                    border:
                      "1px solid #273244",
                    position:
                      "relative",
                  }}
                >
                  <div
                    style={{
                      position:
                        "absolute",
                      top: 16,
                      right: 16,
                      background:
                        "var(--panel2)",
                      borderRadius: 999,
                      padding:
                        "6px 10px",
                      fontSize: 13,
                      color:
                        "#888",
                    }}
                  >
                    #{idx + 1}
                  </div>

                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                    }}
                  >
                    {
                      b.branch_name
                    }
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      color:
                        "#2ee59d",
                      fontSize: 34,
                      fontWeight: 900,
                    }}
                  >
                    {money(
                      b.sales ||
                        b.total ||
                        0
                    )}
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "1fr 1fr",
                      gap: 12,
                      marginTop: 18,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color:
                            "#777",
                          fontSize: 13,
                        }}
                      >
                        신규회원
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 900,
                        }}
                      >
                        {
                          b.new_members
                        }
                        명
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color:
                            "#777",
                          fontSize: 13,
                        }}
                      >
                        출석
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 900,
                        }}
                      >
                        {
                          b.checkins
                        }
                        명
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color:
                            "#777",
                          fontSize: 13,
                        }}
                      >
                        예약
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 900,
                        }}
                      >
                        {
                          b.reservations
                        }
                        건
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          color:
                            "#777",
                          fontSize: 13,
                        }}
                      >
                        상담
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          fontWeight: 900,
                        }}
                      >
                        {b.crm_count ||
                          b.crm_alerts ||
                          0}
                        건
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            mobile
              ? "1fr"
              : "1fr 1fr",
          gap: 18,
        }}
      >
        <div
          className="card"
          style={{
            borderRadius: 24,
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            결제수단 비율
          </h2>

          {[
            [
              "카드",
              paymentMethods.CARD ||
                0,
              "#5da9ff",
            ],
            [
              "현금",
              paymentMethods.CASH ||
                0,
              "#ffd166",
            ],
            [
              "계좌이체",
              paymentMethods.TRANSFER ||
                0,
              "#a78bfa",
            ],
          ].map(
            ([
              name,
              amount,
              color,
            ]) => (
              <div
                key={String(name)}
                style={{
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span>
                    {name}
                  </span>

                  <b>
                    {money(
                      amount
                    )}
                  </b>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: 14,
                    background:
                      "var(--panel2)",
                    borderRadius: 999,
                    overflow:
                      "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${
                        data.sales
                          ? (Number(
                              amount
                            ) /
                              Number(
                                data.sales
                              )) *
                            100
                          : 0
                      }%`,
                      height:
                        "100%",
                      background:
                        color as string,
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>

        <div
          className="card"
          style={{
            borderRadius: 24,
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            운영 체크
          </h2>

          <div
            style={{
              display: "grid",
              gap: 14,
            }}
          >
            {[
              [
                "관리 필요 회원",
                data.alert_members,
                "#ff4d6d",
              ],
              [
                "재연락 상담",
                data.crm_alerts,
                "#f72585",
              ],
              [
                "오늘 출석",
                data.checkins,
                "#5da9ff",
              ],
              [
                "신규회원",
                data.new_members,
                "#2ee59d",
              ],
              [
                "오늘 만료",
                data.today_expire,
                "#f59e0b",
              ],
            ].map(
              ([
                title,
                value,
                color,
              ]) => (
                <div
                  key={String(
                    title
                  )}
                  style={{
                    background:
                      "var(--panel2)",
                    borderRadius: 20,
                    padding: 18,
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color:
                          "#888",
                      }}
                    >
                      {title}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 30,
                        fontWeight: 900,
                        color:
                          color as string,
                      }}
                    >
                      {value}
                    </div>
                  </div>

                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius:
                        999,
                      background:
                        color as string,
                    }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div
  className="card"
  style={{
    borderRadius: 24,
    marginTop: 18,
  }}
>
  <div
    style={{
      display: "flex",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 18,
    }}
  >
    <h2
      style={{
        margin: 0,
      }}
    >
      오늘 만료 회원
    </h2>

    <div
      style={{
        color: "#f59e0b",
        fontWeight: 900,
      }}
    >
      {data.today_expire || 0}명
    </div>
  </div>

  <div
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        {(
          data.today_expire_members ||
          []
        ).map((m: any) => (
          <div
            key={m.member_id}
            style={{
              background: "var(--panel2)",
              borderRadius: 18,
              padding: 16,
              display: "flex",
              justifyContent:
                "space-between",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                }}
              >
                {m.name}
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#888",
                  fontSize: 14,
                }}
              >
                {m.branch_name} /{" "}
                {m.phone}
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "#aaa",
                  fontSize: 13,
                }}
              >
                {m.product_name}
              </div>
            </div>

            <div
              style={{
                color: "#f59e0b",
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              오늘 만료
            </div>
          </div>
        ))}

        {(
          data.today_expire_members ||
          []
        ).length === 0 && (
          <div
            style={{
              color: "#888",
            }}
          >
            오늘 만료 회원이
            없습니다.
          </div>
        )}
      </div>
    </div>
    <div
        className="card"
        style={{
          borderRadius: 24,
          marginTop: 18,
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 18,
          }}
        >
          관리자 기능
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mobile
              ? "1fr"
              : "1fr 1fr",
            gap: 14,
          }}
        >
          <a
            href="/users/pending"
            style={{
              textDecoration: "none",
            }}
          >
            <div
              style={{
                background: "var(--panel2)",
                borderRadius: 20,
                padding: 20,
                border: "1px solid #273244",
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: "#2ee59d",
                }}
              >
                회원가입 승인
              </div>

              <div
                style={{
                  marginTop: 10,
                  color: "#888",
                }}
              >
                신규 관장/직원 승인관리
              </div>
            </div>
          </a>
        </div>
      </div>
    </AppShell>
  );
}