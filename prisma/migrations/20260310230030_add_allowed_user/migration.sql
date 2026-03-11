-- CreateTable
CREATE TABLE "AllowedUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllowedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedUser_email_key" ON "AllowedUser"("email");

-- Seed allowed emails
INSERT INTO "AllowedUser" ("id", "email") VALUES
  (gen_random_uuid()::text, 'arim.paulaana@gmail.com'),
  (gen_random_uuid()::text, 'wcra1988@gmail.com');
