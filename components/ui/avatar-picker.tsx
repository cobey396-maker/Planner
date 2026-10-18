"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import type { TaskColor } from "@/lib/design/tokens";

/**
 * Pick a profile photo. The image is cropped to a centered square and
 * shrunk to 256×256 JPEG in the browser (with a <canvas>) BEFORE uploading:
 * a 4 MB phone photo becomes ~30 KB, uploads fast, and strips the original's
 * hidden EXIF data (like GPS location) for privacy.
 */
export async function squareJpeg(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), "image/jpeg", 0.85),
  );
}

export function AvatarPicker({
  name,
  color,
  src,
  onPicked,
  busy = false,
}: {
  name: string;
  color: TaskColor;
  src: string | null;
  /** Receives the processed 256px JPEG. */
  onPicked: (photo: Blob) => void;
  busy?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That's not an image.");
      return;
    }
    try {
      onPicked(await squareJpeg(file));
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.");
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative rounded-full"
        aria-label={src ? "Change profile photo" : "Add profile photo"}
      >
        <Avatar name={name || "?"} color={color} src={src} size={120} className="text-4xl" />
        <span className="absolute bottom-1 right-1 grid size-9 place-items-center rounded-full bg-tint text-on-tint shadow-float">
          {busy ? <Loader2 aria-hidden size={18} className="animate-spin" /> : <Camera aria-hidden size={18} />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p role="alert" className="text-subhead text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
