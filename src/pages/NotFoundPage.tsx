import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Page, PageHeader } from '@/components/layout/Page';

// Catch-all for unknown paths inside the AppShell — before this existed, a bad URL rendered
// the chrome around an empty page with no explanation.
//
// It opens exactly like every other page: a masthead, one line of explanation, one way out. It
// used to be a bare `Lead` with no `Page` around it, so a 1152px-wide plate held one icon, one
// heading and one button — a page title in a box, which is the corollary DESIGN.md § Composition
// names first. Nothing here is liftable, so nothing here gets a plate.
export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <Page width="reading">
      <PageHeader
        title="Page not found"
        support={
          <>
            Nothing lives at <span className="figures">{pathname}</span>.
          </>
        }
        action={
          <Button asChild>
            <Link to="/">Back to Dashboard</Link>
          </Button>
        }
      />
    </Page>
  );
}
