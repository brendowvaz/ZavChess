-- Lichess PuzzleId is base62, so IDs that differ only by letter case are distinct.
ALTER TABLE `PuzzleAttempt` DROP FOREIGN KEY `PuzzleAttempt_puzzleId_fkey`;

ALTER TABLE `Puzzle`
  MODIFY `id` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

ALTER TABLE `PuzzleAttempt`
  MODIFY `puzzleId` VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

ALTER TABLE `PuzzleAttempt`
  ADD CONSTRAINT `PuzzleAttempt_puzzleId_fkey`
  FOREIGN KEY (`puzzleId`) REFERENCES `Puzzle`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
