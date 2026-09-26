/**
 * Client-side photo resizing: profile pictures are stored as small JPEG data
 * URLs (Convex documents cap at 1 MiB), so the upload is cropped to a square
 * and downscaled before it ever leaves the device.
 */
export async function fileToAvatarDataUrl(file: File, size = 320): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen (JPG, PNG o WEBP).");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("La imagen supera los 8 MB: elige una más ligera.");
  }

  const source = await loadImage(URL.createObjectURL(file));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no permite procesar la imagen.");

  // Center-crop to a square, then draw at the target size.
  const side = Math.min(source.width, source.height);
  const sx = (source.width - side) / 2;
  const sy = (source.height - side) / 2;
  context.drawImage(source, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(src);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };
    image.src = src;
  });
}
