export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>스트롱복싱 광고성과 보고서</title>
      </head>
      <body style={{ margin: 0, padding: 0, background: "#fff" }}>
        {children}
      </body>
    </html>
  );
}
