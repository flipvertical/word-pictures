export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-medium">Word Pictures — teacher sign in</h1>
      <form method="post" action="/api/teacher/login" className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">Wrong password — try again.</p>}
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-3 py-2 text-white hover:bg-neutral-700"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
