import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
      <h2 className="text-3xl font-bold">404 - Page Not Found</h2>
      <p className="mt-2 text-zinc-400">The page you are looking for does not exist.</p>
      <Link href="/dashboard" className="mt-4 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
        Return to Dashboard
      </Link>
    </div>
  );
}
