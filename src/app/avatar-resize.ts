// Achica la foto de perfil en el navegador (máximo 512 px, JPEG): pesa poco y
// entra en el límite del bucket avatars y de las server actions.
const AVATAR_SIZE = 512;

export async function resizeAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.85,
    ),
  );
}

// Achica el logo del club (máximo 256 px) y lo deja en PNG para conservar la
// transparencia; entra en el límite de 1 MB del bucket club-logos.
const LOGO_SIZE = 256;

export async function resizeLogo(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LOGO_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"),
  );
}
