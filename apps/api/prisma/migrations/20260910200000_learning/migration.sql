CREATE TABLE `StudyReview` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(12) NOT NULL, `contentId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  `side` VARCHAR(1) NOT NULL DEFAULT '', `stage` INTEGER NOT NULL DEFAULT 0,
  `repetitions` INTEGER NOT NULL DEFAULT 0, `dueAt` DATETIME(3) NOT NULL, `lastStudiedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `StudyReview_userId_kind_contentId_side_key` (`userId`,`kind`,`contentId`,`side`),
  INDEX `StudyReview_userId_dueAt_idx` (`userId`,`dueAt`),
  CONSTRAINT `StudyReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `StudyEvent` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `requestId` VARCHAR(100) COLLATE utf8mb4_bin NOT NULL,
  `kind` VARCHAR(12) NOT NULL, `contentId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL, `side` VARCHAR(1) NOT NULL DEFAULT '',
  `completed` BOOLEAN NOT NULL, `success` BOOLEAN NOT NULL, `mistakes` INTEGER NOT NULL DEFAULT 0,
  `hintUsed` BOOLEAN NOT NULL DEFAULT false, `rating` INTEGER NOT NULL, `result` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `StudyEvent_userId_requestId_key` (`userId`,`requestId`), INDEX `StudyEvent_userId_createdAt_idx` (`userId`,`createdAt`),
  CONSTRAINT `StudyEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `PuzzlePractice` (
  `id` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL, `puzzleId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
  `practiceId` VARCHAR(100) COLLATE utf8mb4_bin NOT NULL, `mistakes` INTEGER NOT NULL DEFAULT 0,
  `hintUsed` BOOLEAN NOT NULL DEFAULT false, `solved` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`),
  UNIQUE INDEX `PuzzlePractice_userId_puzzleId_practiceId_key` (`userId`,`puzzleId`,`practiceId`),
  CONSTRAINT `PuzzlePractice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
