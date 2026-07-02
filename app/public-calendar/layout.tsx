export default function PublicCalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, background: "#f8fafc", fontFamily: "-apple-system, 'Apple SD Gothic Neo', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
