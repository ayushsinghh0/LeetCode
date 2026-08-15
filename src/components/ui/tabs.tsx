import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/utils/cn';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center justify-start gap-1 border-b border-border text-muted-foreground',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-h-10 items-center justify-center whitespace-nowrap border-b-2 border-transparent px-3 pb-2 pt-1.5 text-sm font-medium ring-offset-background transition-colors duration-150 ease-swift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/**
 * A tab body.
 *
 * **If you need this to be a flex container, write `data-[state=active]:flex`, never a bare
 * `flex`.** Radix keeps every previously-opened panel mounted and marks the inactive ones with the
 * `hidden` attribute. `[hidden] { display: none }` is a UA-origin rule, so any author-origin
 * `display` — including Tailwind's `flex` or `md:flex` — beats it and the panel stays laid out.
 * Every panel then remains a flex item of the same parent and they split the height N ways: on
 * /analytics that made the DEFAULT panel a 22px slit at 1280×800 and a zero-height box at 125%
 * zoom, while the shell's own overflow metric still read 0 — because a zero-height panel overflows
 * nothing. It also leaves the empty inactive panels in the tab order as phantom focus stops.
 */
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
