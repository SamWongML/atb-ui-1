import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

interface AtbIconProps extends React.ComponentProps<"span"> {
  /**
   * If true, play a one-time entrance spin animation.
   */
  animate?: boolean;
  /**
   * If true, disable hover spin animation.
   */
  noSpin?: boolean;
  /**
   * If true, show a border around the icon.
   */
  bordered?: boolean;
  /**
   * Size of the bordered icon: "sm" (default), "md", "lg"
   */
  size?: "sm" | "md" | "lg";
}

const borderedSizes = {
  sm: { wrapper: "p-1.5", icon: "size-3.5" },
  md: { wrapper: "p-2", icon: "size-4" },
  lg: { wrapper: "p-2.5", icon: "size-5" },
};

/**
 * The auto-tobe "Orbit" mark: a single node riding a closed ring.
 * A single-color silhouette drawn with `currentColor` (stroke + fill), so it
 * adapts to light/dark themes and any context automatically, and revolves as a
 * true orbit when a loader spins the wrapper.
 */
function OrbitMark() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="block size-full"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="31" stroke="currentColor" strokeWidth="9" />
      <circle cx="50" cy="19" r="11" fill="currentColor" />
    </svg>
  );
}

export function AtbIcon({
  className,
  animate = false,
  noSpin = false,
  bordered = false,
  size = "sm",
  ...props
}: AtbIconProps) {
  const [entranceDone, setEntranceDone] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const timer = setTimeout(() => setEntranceDone(true), 600);
    return () => clearTimeout(timer);
  }, [animate]);

  if (bordered) {
    const sizeConfig = borderedSizes[size];
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center border border-border rounded-md",
          sizeConfig.wrapper,
          className
        )}
        aria-hidden="true"
        {...props}
      >
        <span
          className={cn(
            "block",
            sizeConfig.icon,
            !entranceDone && "animate-entrance-spin",
            entranceDone && !noSpin && "hover:animate-spin"
          )}
        >
          <OrbitMark />
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-block size-[1em]",
        !entranceDone && "animate-entrance-spin",
        entranceDone && !noSpin && "hover:animate-spin",
        className
      )}
      aria-hidden="true"
      {...props}
    >
      <OrbitMark />
    </span>
  );
}
