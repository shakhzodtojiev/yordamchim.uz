"use client";

import dynamic from "next/dynamic";

// react-player accesses `window` on load; ssr:false keeps the RSC render
// from crashing and lets the client bundle handle the iframe/native switch
// (YouTube, Vimeo, direct MP4 — the same component handles all three).
const ReactPlayer = dynamic(() => import("react-player/lazy"), { ssr: false });

export function VideoPlayer({
  url,
  title,
}: {
  url: string;
  title?: string;
}) {
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-md bg-black">
      <ReactPlayer
        url={url}
        controls
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
        config={{
          youtube: { playerVars: { modestbranding: 1, rel: 0 } },
          file: { attributes: { controlsList: "nodownload", disablePictureInPicture: true } },
        }}
      />
      {title ? <span className="sr-only">{title}</span> : null}
    </div>
  );
}
