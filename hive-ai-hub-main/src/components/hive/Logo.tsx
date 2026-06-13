export function HiveLogo({ size = 28, withWordmark = false }: { size?: number; withWordmark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="hive-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.5 27.5 9v14L16 29.5 4.5 23V9L16 2.5Z"
          fill="url(#hive-grad)"
        />
        <path
          d="M11.5 11.5h6.2c1.8 0 3 1 3 2.6 0 1.1-.6 1.9-1.6 2.2 1.2.3 2 1.2 2 2.5 0 1.8-1.3 2.7-3.3 2.7H11.5v-10Zm2.2 1.7v2.4h3.4c.9 0 1.5-.5 1.5-1.2 0-.8-.6-1.2-1.5-1.2h-3.4Zm0 4v2.6h3.6c1 0 1.6-.5 1.6-1.3 0-.8-.6-1.3-1.6-1.3h-3.6Z"
          fill="white"
        />
      </svg>
      {withWordmark && (
        <span className="text-[17px] font-bold tracking-tight">HiVe</span>
      )}
    </div>
  );
}
