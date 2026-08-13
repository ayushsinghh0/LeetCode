import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Lead } from '@/components/layout/Page';

// Catch-all for unknown paths inside the AppShell — before this existed, a bad URL rendered
// the chrome around an empty page with no explanation.
export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <Lead className="flex flex-col items-center gap-4 text-center">
      <Compass className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gradient">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          Nothing lives at <span className="figures">{pathname}</span>.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </Lead>
  );
}
