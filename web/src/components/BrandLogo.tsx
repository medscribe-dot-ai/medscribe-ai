import { cn } from "../lib/cn";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={cn("relative mx-auto block aspect-[420/305] w-52 overflow-hidden sm:w-60", className)}>
      <img
        src="/logo.png"
        alt="MedScribeAI"
        className="absolute left-[-9.5%] top-[-47.5%] h-[164%] w-[119%] max-w-none"
      />
    </span>
  );
}

type BrandLockupProps = {
  collapsed?: boolean;
  className?: string;
};

export function BrandLockup({ collapsed = false, className }: BrandLockupProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", collapsed && "justify-center", className)}>
      <span className={cn("relative shrink-0 overflow-hidden", collapsed ? "size-9" : "size-11")}>
        <img
          src="/logo.png"
          alt={collapsed ? "MedScribeAI" : ""}
          className="absolute top-[-71%] left-[-71%] h-[246%] w-[246%] max-w-none"
        />
      </span>
      {collapsed ? null : (
        <span className="truncate text-base font-semibold tracking-tight text-primary-hover">MedScribeAI</span>
      )}
    </div>
  );
}
