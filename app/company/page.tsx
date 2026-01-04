export default function CompanyPage() {
  return (
    <div style={{ padding: '20px', backgroundColor: 'red', color: 'white', fontSize: '24px' }}>
      <h1>COMPANY PAGE TEST - NO HOOKS</h1>
      <p>Если вы видите это - страница работает!</p>
      <p>Время: {new Date().toISOString()}</p>
    </div>
  )
}
