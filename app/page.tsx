import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-medium">Word Pictures</h1>
      <p className="text-neutral-500">
        Click into a picture, gather the words to describe it, and write.
      </p>
      <p className="text-sm text-neutral-400">
        Students: use the link your teacher shared with you.
      </p>
      <Link
        href="/teacher"
        className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50"
      >
        Teacher sign in
      </Link>
    </main>
  );
}
