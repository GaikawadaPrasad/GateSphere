/**
 * Full page load to `url`. Used on identity changes (sign-out, session loss): unloading the
 * document discards the whole in-memory query cache and aborts in-flight requests, which is
 * what AGENTS.md §5.3 needs — without the refetch burst a `queryClient.clear()` on a still
 * mounted dashboard causes. One seam so tests can observe it.
 */
export function hardNavigate(url: string): void {
  window.location.replace(url);
}
