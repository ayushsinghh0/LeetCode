import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';

import { cn } from '@/utils/cn';

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  // The indicator draws from zero on first paint, then settles at its value through the same
  // 500ms transition later changes use — so opening a page shows progress *filling* rather than
  // already filled, which is the difference between a report and a response. Accessibility is
  // untouched: `value` goes straight to the Root, so `aria-valuenow` is correct from the first
  // render and only the paint animates. Reduced motion zeroes the transition globally (index.css)
  // and the bar simply appears full.
  const [drawn, setDrawn] = React.useState(false);
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const shown = drawn ? value || 0 : 0;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn('relative h-2 w-full overflow-hidden rounded-[3px] bg-muted', className)}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-transform duration-500 ease-swift"
        style={{ transform: `translateX(-${100 - shown}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
