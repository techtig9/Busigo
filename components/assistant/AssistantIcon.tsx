// A small custom mark for the assistant — a four-point spark inside a rounded square,
// rendered in the signal/pulse gradient so it reads as "part of busigo" rather than a
// generic chat-bubble icon borrowed from an icon set.
export function AssistantIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="assistant-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B3A67" />
          <stop offset="1" stopColor="#0EA5A0" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="7" fill="url(#assistant-grad)" />
      <path
        d="M12 5.5L13.4 10.1L18 11.5L13.4 12.9L12 17.5L10.6 12.9L6 11.5L10.6 10.1L12 5.5Z"
        fill="white"
      />
    </svg>
  );
}
