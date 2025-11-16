// app/components/Card.tsx
export default function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded shadow-sm p-4">
      {children}
    </div>
  );
}
