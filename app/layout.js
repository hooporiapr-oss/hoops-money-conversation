export const metadata = {
  title: 'Hoops.Money — The Business of Basketball',
  description: 'The grassroots NIL platform for basketball players.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
