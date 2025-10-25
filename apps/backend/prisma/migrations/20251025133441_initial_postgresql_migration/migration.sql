-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "familyId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "publicKey" TEXT NOT NULL,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "googleCalendarToken" TEXT,
    "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "inviteCode" TEXT NOT NULL,
    "maxMembers" INTEGER NOT NULL DEFAULT 10,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(10),
    "createdById" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedContent" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "encryptedContent" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_folders" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" VARCHAR(10),
    "createdById" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "encryptedCaption" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "likes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_comments" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "encryptedComment" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" DATE NOT NULL,
    "startTime" TIME(6),
    "endTime" TIME(6),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "reminder" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinutes" INTEGER,
    "color" VARCHAR(7),
    "googleEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_familyId_idx" ON "users"("familyId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "families_inviteCode_key" ON "families"("inviteCode");

-- CreateIndex
CREATE INDEX "families_inviteCode_idx" ON "families"("inviteCode");

-- CreateIndex
CREATE INDEX "channels_familyId_idx" ON "channels"("familyId");

-- CreateIndex
CREATE INDEX "messages_channelId_timestamp_idx" ON "messages"("channelId", "timestamp");

-- CreateIndex
CREATE INDEX "scheduled_messages_scheduledTime_idx" ON "scheduled_messages"("scheduledTime");

-- CreateIndex
CREATE INDEX "scheduled_messages_status_idx" ON "scheduled_messages"("status");

-- CreateIndex
CREATE INDEX "photo_folders_familyId_idx" ON "photo_folders"("familyId");

-- CreateIndex
CREATE INDEX "photos_folderId_idx" ON "photos"("folderId");

-- CreateIndex
CREATE INDEX "photos_uploadedAt_idx" ON "photos"("uploadedAt");

-- CreateIndex
CREATE INDEX "photo_comments_photoId_idx" ON "photo_comments"("photoId");

-- CreateIndex
CREATE INDEX "calendar_events_familyId_idx" ON "calendar_events"("familyId");

-- CreateIndex
CREATE INDEX "calendar_events_date_idx" ON "calendar_events"("date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_folders" ADD CONSTRAINT "photo_folders_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_folders" ADD CONSTRAINT "photo_folders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "photo_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_comments" ADD CONSTRAINT "photo_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
