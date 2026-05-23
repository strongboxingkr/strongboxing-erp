"use client";

import { useState } from "react";

export default function TestCheckinPage() {
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<any>(null);

  const handleCheckin = async () => {
    const res = await fetch("/api/check-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_last4: phone,
      }),
    });

    const data = await res.json();
    setResult(data);
  };

  return (
    <div style={{ padding: 40 }}>
      <h1>출석 테스트</h1>

      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="전화번호 뒤 4자리"
        style={{
          padding: 10,
          fontSize: 20,
        }}
      />

      <button
        onClick={handleCheckin}
        style={{
          marginLeft: 10,
          padding: 10,
          fontSize: 20,
        }}
      >
        출석
      </button>

      <pre>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}