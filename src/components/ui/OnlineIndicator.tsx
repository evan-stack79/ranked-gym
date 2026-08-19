export function OnlineIndicator() {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30D158] opacity-40" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#30D158] online-dot" />
      </span>
      <span className="text-[10px] font-medium text-[#8E8E93]">En ligne</span>
    </div>
  )
}
