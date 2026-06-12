export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center p-6">
      <div
        className="rounded-[14px] bg-surface p-7"
        style={{
          boxShadow: "0 2px 6px rgba(20,28,24,0.12), 0 12px 28px rgba(20,28,24,0.14)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-green">
          Word Pictures
        </p>
        <h1 className="mt-1 font-serif text-[22px] font-medium text-ink">Teacher sign in</h1>
        <form method="post" action="/api/teacher/login" className="mt-5 flex flex-col gap-3">
          <input
            type="password"
            name="password"
            placeholder="Password"
            autoFocus
            className="rounded-lg border border-border-stronger bg-ivory px-3 py-2 text-ink placeholder:text-muted"
          />
          {error && <p className="text-sm text-red-700">Wrong password — try again.</p>}
          <button
            type="submit"
            className="rounded-full bg-green px-4 py-2 text-sm font-semibold text-surface hover:opacity-90"
            style={{ boxShadow: "0 1px 3px rgba(38,53,46,0.3)" }}
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
