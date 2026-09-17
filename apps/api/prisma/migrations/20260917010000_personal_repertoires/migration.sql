CREATE TABLE `OpeningPosition` (
  `key` VARCHAR(64) NOT NULL, `fen` VARCHAR(191) NOT NULL, `openingId` VARCHAR(191) NOT NULL,
  `ply` INTEGER NOT NULL, `title` VARCHAR(500) NOT NULL, `explanation` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`), INDEX `OpeningPosition_openingId_ply_idx` (`openingId`,`ply`),
  CONSTRAINT `OpeningPosition_openingId_fkey` FOREIGN KEY (`openingId`) REFERENCES `Opening`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserRepertoire` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `courseId` VARCHAR(80) NOT NULL,
  `selectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `UserRepertoire_userId_courseId_key` (`userId`,`courseId`),
  INDEX `UserRepertoire_userId_selectedAt_idx` (`userId`,`selectedAt`),
  CONSTRAINT `UserRepertoire_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OpeningGameImport` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `platform` VARCHAR(12) NOT NULL,
  `username` VARCHAR(80) NOT NULL, `gameExternalId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  `playedAt` DATETIME(3) NULL, `color` VARCHAR(1) NOT NULL, `openingId` VARCHAR(191) NULL,
  `firstMissPly` INTEGER NULL, `summary` TEXT NOT NULL,
  `importedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `OpeningGameImport_userId_platform_gameExternalId_key` (`userId`,`platform`,`gameExternalId`),
  INDEX `OpeningGameImport_userId_importedAt_idx` (`userId`,`importedAt`),
  CONSTRAINT `OpeningGameImport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
