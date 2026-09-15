param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [int]$BackgroundFloor = 180
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing.Common
$drawingAssemblies = @(
  [System.Drawing.Bitmap].Assembly.Location,
  [System.Drawing.Color].Assembly.Location,
  [System.Reflection.Assembly]::Load('System.Private.Windows.GdiPlus').Location,
  [System.Reflection.Assembly]::Load('System.Private.Windows.Core').Location,
  [System.Reflection.Assembly]::Load('System.Collections').Location,
  [System.Reflection.Assembly]::Load('System.Runtime').Location,
  [object].Assembly.Location
)
Add-Type -ReferencedAssemblies $drawingAssemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

public static class ZavPieceSheetExtractor
{
    static bool IsOutlineOrDarkDetail(Color pixel, int backgroundFloor)
    {
        int luminance = (pixel.R * 299 + pixel.G * 587 + pixel.B * 114) / 1000;
        return luminance < backgroundFloor;
    }

    public static void Extract(string inputPath, string outputPath, int backgroundFloor)
    {
        using (var input = new Bitmap(inputPath))
        using (var output = new Bitmap(input.Width, input.Height, PixelFormat.Format32bppArgb))
        {
            int width = input.Width;
            int height = input.Height;
            var exterior = new bool[width * height];
            var queue = new int[width * height];
            int queueHead = 0;
            int queueTail = 0;

            Action<int, int> enqueue = (x, y) =>
            {
                int index = y * width + x;
                if (exterior[index] || IsOutlineOrDarkDetail(input.GetPixel(x, y), backgroundFloor)) return;
                exterior[index] = true;
                queue[queueTail++] = index;
            };

            for (int x = 0; x < width; x++)
            {
                enqueue(x, 0);
                enqueue(x, height - 1);
            }
            for (int y = 0; y < height; y++)
            {
                enqueue(0, y);
                enqueue(width - 1, y);
            }

            while (queueHead < queueTail)
            {
                int index = queue[queueHead++];
                int x = index % width;
                int y = index / width;
                if (x > 0) enqueue(x - 1, y);
                if (x + 1 < width) enqueue(x + 1, y);
                if (y > 0) enqueue(x, y - 1);
                if (y + 1 < height) enqueue(x, y + 1);
            }

            var visited = new bool[width * height];
            var kept = new bool[width * height];
            var component = new int[width * height];
            var best = new int[width * height];
            int cellWidth = width / 6;
            int cellHeight = height / 2;

            for (int row = 0; row < 2; row++)
            {
                int cellTop = row * cellHeight;
                int cellBottom = row == 1 ? height : cellTop + cellHeight;
                for (int column = 0; column < 6; column++)
                {
                    int cellLeft = column * cellWidth;
                    int cellRight = column == 5 ? width : cellLeft + cellWidth;
                    int bestCount = 0;

                    for (int seedY = cellTop; seedY < cellBottom; seedY++)
                    {
                        for (int seedX = cellLeft; seedX < cellRight; seedX++)
                        {
                            int seed = seedY * width + seedX;
                            if (exterior[seed] || visited[seed]) continue;

                            int head = 0;
                            int tail = 0;
                            visited[seed] = true;
                            component[tail++] = seed;

                            while (head < tail)
                            {
                                int current = component[head++];
                                int x = current % width;
                                int y = current / width;

                                for (int dy = -1; dy <= 1; dy++)
                                {
                                    for (int dx = -1; dx <= 1; dx++)
                                    {
                                        if (dx == 0 && dy == 0) continue;
                                        int nextX = x + dx;
                                        int nextY = y + dy;
                                        if (nextX < cellLeft || nextX >= cellRight || nextY < cellTop || nextY >= cellBottom) continue;
                                        int next = nextY * width + nextX;
                                        if (exterior[next] || visited[next]) continue;
                                        visited[next] = true;
                                        component[tail++] = next;
                                    }
                                }
                            }

                            if (tail > bestCount)
                            {
                                bestCount = tail;
                                Array.Copy(component, best, tail);
                            }
                        }
                    }

                    for (int i = 0; i < bestCount; i++) kept[best[i]] = true;
                }
            }

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = y * width + x;
                    Color source = input.GetPixel(x, y);
                    output.SetPixel(x, y, kept[index]
                        ? Color.FromArgb(255, source.R, source.G, source.B)
                        : Color.Transparent);
                }
            }

            string directory = Path.GetDirectoryName(outputPath);
            if (!String.IsNullOrEmpty(directory)) Directory.CreateDirectory(directory);
            output.Save(outputPath, ImageFormat.Png);
        }
    }
}
'@

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
[ZavPieceSheetExtractor]::Extract($resolvedInput, $resolvedOutput, $BackgroundFloor)
Write-Host "Extracted transparent sheet to $resolvedOutput"
