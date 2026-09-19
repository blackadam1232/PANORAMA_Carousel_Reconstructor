export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function reverseItems<T>(items: T[]): T[] {
  return [...items].reverse();
}

export function dimensionsMatch(items: Array<{ width: number; height: number }>): boolean {
  if (items.length < 2) return true;
  return items.every((item) => item.width === items[0].width && item.height === items[0].height);
}
