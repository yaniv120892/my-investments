import { targetRepository } from "@/lib/targets/targetRepository";
import { targetWriteValidator } from "@/lib/targets/targetWriteValidator";
import type {
  ReplaceTargetsInput,
  StoredTargets,
} from "@/lib/targets/target.types";

export class TargetWriteService {
  public async replaceTargets(
    userId: string,
    input: ReplaceTargetsInput
  ): Promise<StoredTargets> {
    targetWriteValidator.assertClassTargetsAreComplete(input.classTargets);
    targetWriteValidator.assertHoldingsAreLiquidAndOwned(
      input.withinClassWeights,
      await targetRepository.findLiquidHoldingIds(userId)
    );

    await targetRepository.replaceTargets(userId, input);
    return targetRepository.findTargets(userId);
  }
}

export const targetWriteService = new TargetWriteService();
