export default function PublicCalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/calendar-icon.png" />
        <link rel="apple-touch-icon" href="/calendar-icon.png" />
        <title>스트롱복싱 예약 캘린더</title>
      </head>
      <body style={{ margin: 0, padding: 0, background: "#f8fafc", fontFamily: "-apple-system, 'Apple SD Gothic Neo', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
