import type { ReactNode } from "react";
const paths: Record<string, ReactNode> = {
  photo: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="8" cy="9" r="1.4" />
      <path d="m4 17 5-5 3 3 3-4 5 5" />
    </>
  ),
  folder: (
    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  ),
  expand: <path d="M14 4h6v6m0-6-7 7M10 20H4v-6m0 6 7-7" />,
  chevron: <path d="m7 10 5 5 5-5" />,
  arrow: <path d="M5 19 19 5M7 5h12v12" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  settings: (
    <>
      <path d="M3 7h7m4 0h7M3 17h11m4 0h3" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
};
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
