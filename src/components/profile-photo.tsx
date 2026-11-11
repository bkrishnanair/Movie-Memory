"use client";

import Image from "next/image";
import { useState } from "react";

export function ProfilePhoto({ image, name }: { image: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return (
      <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl font-semibold text-amber-900">
        {Array.from(name)[0].toUpperCase()}
      </span>
    );
  }

  return (
    <Image
      src={image}
      alt={`${name}'s profile photo`}
      width={56}
      height={56}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-14 shrink-0 rounded-full object-cover"
    />
  );
}
