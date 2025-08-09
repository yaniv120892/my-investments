import { PrismaClient } from "@prisma/client/edge";
import { withAccelerate } from "@prisma/extension-accelerate";

const basePrisma = new PrismaClient({
  log: ["warn", "error"],
});

const acceleratedPrisma = basePrisma.$extends(withAccelerate());

export default acceleratedPrisma;
