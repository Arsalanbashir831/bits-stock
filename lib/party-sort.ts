export function comparePartyNames(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base", numeric: true });
}

export function sortPartyEntries<T extends { party: string; createdAt: Date }>(entries: T[]) {
  return [...entries].sort((left, right) =>
    comparePartyNames(left.party, right.party) ||
    right.createdAt.getTime() - left.createdAt.getTime(),
  );
}
