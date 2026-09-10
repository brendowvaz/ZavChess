CREATE TABLE `OpeningGuide` (
  `family` VARCHAR(191) NOT NULL,
  `overview` TEXT NOT NULL,
  `whitePlan` JSON NOT NULL,
  `blackPlan` JSON NOT NULL,
  `commonMistakes` JSON NOT NULL,
  `lessonIds` JSON NOT NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`family`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
