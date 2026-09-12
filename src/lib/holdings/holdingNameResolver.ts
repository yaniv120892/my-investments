interface NamedHolding {
  assetName: string;
}

/**
 * Exact match wins outright, so a name that is also a substring of a
 * different holding never captures it by accident ("VOO" against "VOO" +
 * "VOOG" resolves to "VOO", not both). The substring fallback is refused
 * when it matches more than one holding — silently picking one would let a
 * caller exclude, or report a trend for, the wrong holding without saying so.
 * A caller with no exact match and no substring match gets an empty array
 * back and raises its own not-found error, since the two current callers
 * word that error differently.
 */
export function resolveHoldingsByName<T extends NamedHolding>(
  holdings: T[],
  rawName: string
): T[] {
  const name = rawName.trim().toLowerCase();
  if (!name) {
    return [];
  }

  const exact = holdings.filter(
    (holding) => holding.assetName.toLowerCase() === name
  );
  if (exact.length > 0) {
    return exact;
  }

  const substringMatches = holdings.filter((holding) =>
    holding.assetName.toLowerCase().includes(name)
  );
  if (substringMatches.length > 1) {
    throw new Error(
      `That name matches more than one holding (name: ${rawName}, matches: ${substringMatches
        .map((holding) => holding.assetName)
        .join(", ")}). Be more specific.`
    );
  }

  return substringMatches;
}
