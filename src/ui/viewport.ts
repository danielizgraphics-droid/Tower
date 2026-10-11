// Size of the area the game draws on. On iPhone home-screen apps the window's
// innerHeight can come up short (a strip was left uncovered at the bottom), so
// the app root's measured size is used, falling back to the window.

export function viewSize(): { w: number; h: number } {
  const root = document.getElementById('app');
  const w = root?.clientWidth || innerWidth;
  const h = root?.clientHeight || innerHeight;
  return { w, h };
}
