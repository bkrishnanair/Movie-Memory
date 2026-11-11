-- Existing Prisma timestamps represent UTC; preserve that instant during conversion.
ALTER TABLE "Fact" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3)
USING "createdAt" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "expires" SET DATA TYPE TIMESTAMPTZ(3)
USING "expires" AT TIME ZONE 'UTC';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DATA TYPE TIMESTAMPTZ(3)
USING "emailVerified" AT TIME ZONE 'UTC',
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3)
USING "createdAt" AT TIME ZONE 'UTC',
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(3)
USING "updatedAt" AT TIME ZONE 'UTC';
