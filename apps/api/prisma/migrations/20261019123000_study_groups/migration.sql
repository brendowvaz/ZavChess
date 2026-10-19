CREATE TABLE `StudyGroup` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `inviteCode` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `StudyGroup_inviteCode_key` (`inviteCode`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StudyGroupMember` (
  `id` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `StudyGroupMember_groupId_userId_key` (`groupId`, `userId`),
  INDEX `StudyGroupMember_userId_idx` (`userId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `StudyGroupMember_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `StudyGroup` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `StudyGroupMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
