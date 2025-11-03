-- CreateTable
CREATE TABLE "message_translations" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "target_language" VARCHAR(5) NOT NULL,
    "encrypted_translation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_translations_message_id_idx" ON "message_translations"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_id_target_language" ON "message_translations"("message_id", "target_language");

-- AddForeignKey
ALTER TABLE "message_translations" ADD CONSTRAINT "message_translations_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
