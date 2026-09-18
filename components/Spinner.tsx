// Small inline spinner for any button/action that's waiting on a network
// request. Several buttons across the app used to just sit there
// unchanged while their fetch was in flight - a slow connection made it
// look like the tap didn't register at all. Every async button should
// show this (or at least disable + visibly change) the moment it starts
// working, not only after it finishes.
export default function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
      />
    </svg>
  );
}
