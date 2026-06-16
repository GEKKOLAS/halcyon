export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <div className="absolute inset-0 grid-fade" />
      <div className="absolute -top-1/3 left-1/4 h-[60vmax] w-[60vmax] animate-aurora rounded-full bg-aurora-teal/20 blur-[120px]" />
      <div
        className="absolute top-1/4 -right-1/4 h-[55vmax] w-[55vmax] animate-aurora rounded-full bg-aurora-violet/20 blur-[120px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="absolute -bottom-1/3 left-1/3 h-[50vmax] w-[50vmax] animate-aurora rounded-full bg-aurora-cyan/15 blur-[120px]"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}
