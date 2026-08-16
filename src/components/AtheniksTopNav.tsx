"use client";

import Link from "next/link";

function AtheniksLogoMark({ className }: { className?: string }) {
  return (
    <svg
      width="26"
      height="22"
      viewBox="0 0 38 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="1" y="16" width="5" height="13" rx="1.5" fill="#2747B6" />
      <rect x="8" y="9" width="5" height="20" rx="1.5" fill="#3D6CF4" />
      <rect x="15" y="3" width="5" height="26" rx="1.5" fill="#47B5FF" />
      <rect x="22" y="10" width="5" height="19" rx="1.5" fill="#28C7C3" />
      <rect x="29" y="15" width="5" height="14" rx="1.5" fill="#35D39A" />
    </svg>
  );
}

export function AtheniksTopNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e8e8e8] bg-white">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <AtheniksLogoMark />
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-[#0a0a0a]">
            Atheniks
          </span>
        </Link>
      </div>
    </header>
  );
}
