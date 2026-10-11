export function planCollectionName(researchCode: string): string {
  const safe = researchCode.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50);
  if (!safe) {
    throw new Error("Araştırma kodu yok.");
  }
  return `plan_${safe}`;
}

export function highIndexLeftovers(previousIds: readonly number[], nextCount: number): number[] {
  return previousIds.filter((id) => id >= nextCount);
}

type DeleteClient = {
  deleteCollection(name: string): Promise<unknown>;
};

type ReplaceClient = DeleteClient & {
  createCollection(
    name: string,
    config: { vectors: { size: number; distance: "Cosine" } },
  ): Promise<unknown>;
};

function isMissingCollection(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? (error as { status?: unknown }).status : undefined;
  const message = error instanceof Error ? error.message : "";
  return status === 404 || /not found|does not exist|doesn't exist/i.test(message);
}

export async function removeSearchPoints(client: DeleteClient, researchCode: string) {
  const collection = planCollectionName(researchCode);
  try {
    await client.deleteCollection(collection);
  } catch (error) {
    if (!isMissingCollection(error)) throw error;
  }
  return { collection, submissions: "keep" as const };
}

export async function replaceSearchPoints(client: ReplaceClient, researchCode: string) {
  const collection = planCollectionName(researchCode);
  await removeSearchPoints(client, researchCode);
  await client.createCollection(collection, {
    vectors: { size: 1536, distance: "Cosine" },
  });
  return { collection, submissions: "keep" as const };
}
