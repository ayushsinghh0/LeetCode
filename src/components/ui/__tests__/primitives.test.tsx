import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

// Radix components emit console.error/console.warn on a11y or usage mistakes.
// Every test below asserts these stay silent so the suite fails loudly on any
// regression (e.g. a Dialog missing its Title/Description).
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  expect(errorSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('Button', () => {
  test('renders visible text and fires its click handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Card', () => {
  test('renders the full card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Two Sum</CardTitle>
          <CardDescription>Array pattern</CardDescription>
        </CardHeader>
        <CardContent>Body content</CardContent>
        <CardFooter>Footer content</CardFooter>
      </Card>,
    );

    expect(screen.getByText('Two Sum')).toBeInTheDocument();
    expect(screen.getByText('Array pattern')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });
});

describe('Badge', () => {
  test('renders visible text', () => {
    render(<Badge>Easy</Badge>);
    expect(screen.getByText('Easy')).toBeInTheDocument();
  });
});

describe('Progress', () => {
  test('reflects the value prop via aria-valuenow', () => {
    render(<Progress value={42} aria-label="Roadmap progress" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });
});

describe('Input + Label', () => {
  test('label is associated with the input and typing updates its value', () => {
    render(
      <>
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Enter name" />
      </>,
    );

    const input = screen.getByLabelText('Name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada Lovelace' } });
    expect(input.value).toBe('Ada Lovelace');
  });
});

describe('Textarea', () => {
  test('renders and accepts typed input', () => {
    render(<Textarea placeholder="Notes" />);
    const textarea = screen.getByPlaceholderText('Notes') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Some notes' } });
    expect(textarea.value).toBe('Some notes');
  });
});

describe('Switch', () => {
  test('renders as an accessible switch control', () => {
    render(<Switch aria-label="Enable notifications" />);
    expect(screen.getByRole('switch', { name: 'Enable notifications' })).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  test('shows the active panel and switches on trigger click', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Tab A</TabsTrigger>
          <TabsTrigger value="b">Tab B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">Panel A</TabsContent>
        <TabsContent value="b">Panel B</TabsContent>
      </Tabs>,
    );

    expect(screen.getByText('Panel A')).toBeInTheDocument();
    expect(screen.queryByText('Panel B')).not.toBeInTheDocument();

    // Radix's TabsTrigger activates on mousedown (not click) so it can support
    // "activate on focus" semantics; fireEvent.click alone never fires mousedown.
    fireEvent.mouseDown(screen.getByText('Tab B'));
    expect(screen.getByText('Panel B')).toBeInTheDocument();
  });
});

describe('Tooltip', () => {
  test('renders its trigger without crashing', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });
});

describe('Select', () => {
  // jsdom does not implement the pointer-capture APIs Radix Select needs to open
  // its listbox, so this is intentionally a render-only smoke test of the closed
  // trigger — it does not exercise open/select interaction.
  test('renders the closed trigger without crashing', () => {
    render(
      <Select>
        <SelectTrigger aria-label="Pattern">
          <SelectValue placeholder="Select a pattern..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="two-pointers">Two Pointers</SelectItem>
          <SelectItem value="sliding-window">Sliding Window</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText('Select a pattern...')).toBeInTheDocument();
  });
});

describe('Dialog', () => {
  test('opens on trigger click and shows its content with a title', () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Question details</DialogTitle>
            <DialogDescription>Everything about this question.</DialogDescription>
          </DialogHeader>
          <p>Body content</p>
          <DialogFooter>
            <DialogClose>Close</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByText('Body content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Open'));

    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Question details' })).toBeInTheDocument();
  });
});
