import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Personal CRM</h1>
      <p className="mt-2 text-sm text-slate-600">Open a person profile to add screenshots and voice notes.</p>
      <Link href="/people/demo" className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white">Go to sample person</Link>
    </main>
  );
}
