import type { Platform } from "@prisma/client";
import type { HoldingRepository } from "@/lib/holdings/holdingRepository";
import { holdingRepository } from "@/lib/holdings/holdingRepository";
import type { PlatformWriteValidator } from "@/lib/holdings/platformWriteValidator";
import { platformWriteValidator } from "@/lib/holdings/platformWriteValidator";
import type { CreatePlatformInput } from "@/lib/holdings/holdingWrite.types";

export class PlatformWriteService {
  public constructor(
    private readonly repository: HoldingRepository = holdingRepository,
    private readonly validator: PlatformWriteValidator = platformWriteValidator
  ) {}

  public async listPlatforms(userId: string): Promise<Platform[]> {
    return this.repository.listPlatforms(userId);
  }

  public async createPlatform(
    userId: string,
    input: CreatePlatformInput
  ): Promise<Platform> {
    await this.validator.assertCanCreatePlatform(userId, input);
    return this.repository.createPlatform(
      userId,
      input.name,
      input.baseCurrency
    );
  }
}

export const platformWriteService = new PlatformWriteService();
