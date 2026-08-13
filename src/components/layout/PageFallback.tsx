/**
 * The placeholder a lazy route shows while its chunk arrives.
 *
 * Rendered inside `AppShell`, in the page column only — the sidebar, mobile nav and brand paint
 * immediately and stay put. (It lived above the shell once, which meant the first visit replaced
 * the whole application with this one pulsing plate until the route chunk resolved.)
 */
export function PageFallback() {
  return (
    <div
      className="glass flex min-h-[240px] w-full animate-pulse items-center justify-center p-6"
      aria-busy="true"
    >
      <div className="h-8 w-8 rounded-full bg-accent-gradient" />
    </div>
  );
}

export default PageFallback;
