/*
  Warnings:

  - Added the required column `receiver_email` to the `team_invites` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "team_invites" ADD COLUMN     "receiver_email" TEXT NOT NULL,
ALTER COLUMN "receiver_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "team_invites_receiver_email_idx" ON "team_invites"("receiver_email");
