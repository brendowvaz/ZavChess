param(
  [string]$AssetsDirectory = (Join-Path $PSScriptRoot '..\apps\mobile\assets\pieces')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing.Common
$drawingAssemblies = @(
  [System.Drawing.Bitmap].Assembly.Location,
  [System.Drawing.Color].Assembly.Location,
  [System.Reflection.Assembly]::Load('System.Private.Windows.GdiPlus').Location,
  [System.Reflection.Assembly]::Load('System.Private.Windows.Core').Location,
  [System.Reflection.Assembly]::Load('System.Runtime').Location,
  [object].Assembly.Location
)
Add-Type -ReferencedAssemblies $drawingAssemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class ZavPieceSpriteBuilder
{
    const int Columns = 6;
    const int Rows = 2;
    const int Cell = 256;

    static Rectangle FindVisibleBounds(Bitmap source, Rectangle region)
    {
        int minX = region.Right, minY = region.Bottom, maxX = region.Left, maxY = region.Top;
        for (int y = region.Top; y < region.Bottom; y++)
        {
            for (int x = region.Left; x < region.Right; x++)
            {
                if (source.GetPixel(x, y).A <= 24) continue;
                minX = Math.Min(minX, x); minY = Math.Min(minY, y);
                maxX = Math.Max(maxX, x); maxY = Math.Max(maxY, y);
            }
        }
        if (maxX < minX || maxY < minY) throw new InvalidDataException("Empty sprite cell.");
        return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
    }

    public static void Build(string sourcePath, string outputPath, int rowSplit)
    {
        using (var source = new Bitmap(sourcePath))
        {
            if ((source.PixelFormat & PixelFormat.Alpha) == 0 || source.GetPixel(0, 0).A != 0)
                throw new InvalidDataException("Source sheet must have a transparent background: " + sourcePath);

            var bounds = new Rectangle[Columns * Rows];
            int sourceCell = source.Width / Columns;
            int maxWidth = 0, maxHeight = 0;
            for (int row = 0; row < Rows; row++)
            {
                int top = row == 0 ? 0 : rowSplit;
                int bottom = row == 0 ? rowSplit : source.Height;
                for (int column = 0; column < Columns; column++)
                {
                    int left = column * sourceCell;
                    int right = column == Columns - 1 ? source.Width : (column + 1) * sourceCell;
                    var region = Rectangle.FromLTRB(left, top, right, bottom);
                    var box = FindVisibleBounds(source, region);
                    bounds[row * Columns + column] = box;
                    maxWidth = Math.Max(maxWidth, box.Width);
                    maxHeight = Math.Max(maxHeight, box.Height);
                }
            }

            float scale = Math.Min(230f / maxWidth, 242f / maxHeight);
            using (var output = new Bitmap(Columns * Cell, Rows * Cell, PixelFormat.Format32bppArgb))
            using (var graphics = Graphics.FromImage(output))
            {
                graphics.Clear(Color.Transparent);
                graphics.CompositingMode = CompositingMode.SourceCopy;
                graphics.CompositingQuality = CompositingQuality.HighQuality;
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                for (int row = 0; row < Rows; row++)
                {
                    for (int column = 0; column < Columns; column++)
                    {
                        var sourceBox = bounds[row * Columns + column];
                        int width = (int)Math.Round(sourceBox.Width * scale);
                        int height = (int)Math.Round(sourceBox.Height * scale);
                        int x = column * Cell + (Cell - width) / 2;
                        int y = row * Cell + 249 - height;
                        var destination = new Rectangle(x, y, width, height);
                        graphics.DrawImage(source, destination, sourceBox, GraphicsUnit.Pixel);
                    }
                }
                output.Save(outputPath, ImageFormat.Png);
            }
        }
    }
}
'@

$specs = @(
  @{ Name = 'classic'; Split = 630 },
  @{ Name = 'geometric'; Split = 635 },
  @{ Name = 'rounded'; Split = 650 },
  @{ Name = 'sculpted'; Split = 605 }
)

$webSpecs = @(
  @{ Name = 'classic-web'; Split = 362 },
  @{ Name = 'geometric-web'; Split = 362 },
  @{ Name = 'rounded-web'; Split = 362 },
  @{ Name = 'sculpted-web'; Split = 362 }
)

foreach ($spec in $webSpecs) {
  $candidate = Join-Path $AssetsDirectory "$($spec.Name).png"
  if (Test-Path -LiteralPath $candidate) { $specs += $spec }
}

foreach ($spec in $specs) {
  $source = Join-Path $AssetsDirectory "$($spec.Name).png"
  $output = Join-Path $AssetsDirectory "$($spec.Name)-sprite.png"
  [ZavPieceSpriteBuilder]::Build($source, $output, $spec.Split)
  Write-Host "Built $output"
}
