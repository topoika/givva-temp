export default function LoadingSpinner() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-white">
      <span
        role="status"
        aria-label="Loading"
        className="size-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500"
      />
    </main>
  );
}
