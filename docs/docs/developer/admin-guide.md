---
sidebar_position: 3
---

# Admin Dashboard Development Guide

This guide explains how to add new features to the Forja React admin dashboard. The admin is built with Vite, Material UI, React Query, react-hook-form, and zod.

## Architecture Overview

Every admin feature follows a consistent pattern:

1. **Types** (`src/types/api.ts`) -- TypeScript interfaces mirroring the backend DTOs.
2. **Service** (`src/services/api.ts`) -- Axios-based API methods for the new resource.
3. **Page Component** (`src/pages/`) -- The page-level React component.
4. **Routing** (`App.tsx`) -- Route registration in the application router.

## Step 1: Add TypeScript Types

Add interfaces to `admin/src/types/api.ts` that mirror the backend DTOs. These keep the frontend in sync with the API contract.

```typescript
// admin/src/types/api.ts

// --- Bookmarks ---

export interface Bookmark {
  id: string;
  site_id: string;
  title: string;
  url: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBookmarkRequest {
  title: string;
  url: string;
  description?: string;
}

export interface UpdateBookmarkRequest {
  title?: string;
  url?: string;
  description?: string;
}
```

## Step 2: Add API Service Methods

Add methods to `admin/src/services/api.ts` using the existing Axios instance. Follow the established patterns for CRUD operations.

```typescript
// admin/src/services/api.ts

// --- Bookmarks ---

export const bookmarkApi = {
  list: (siteId: string, page = 1, perPage = 10) =>
    api.get<PaginatedResponse<Bookmark>>(
      `/sites/${siteId}/bookmarks?page=${page}&per_page=${perPage}`
    ),

  get: (siteId: string, id: string) =>
    api.get<Bookmark>(`/sites/${siteId}/bookmarks/${id}`),

  create: (siteId: string, data: CreateBookmarkRequest) =>
    api.post<Bookmark>(`/sites/${siteId}/bookmarks`, data),

  update: (siteId: string, id: string, data: UpdateBookmarkRequest) =>
    api.put<Bookmark>(`/sites/${siteId}/bookmarks/${id}`, data),

  delete: (siteId: string, id: string) =>
    api.delete(`/sites/${siteId}/bookmarks/${id}`),
};
```

## Step 3: Create the Page Component

Create a new page component in `admin/src/pages/`. Use Material UI components for consistency with the rest of the dashboard.

```tsx
// admin/src/pages/BookmarksPage.tsx

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { bookmarkApi } from '../services/api';
import { useSiteContext } from '@/store/SiteContext';

export default function BookmarksPage() {
  const { currentSite } = useSiteContext();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks', currentSite?.id, page],
    queryFn: () => bookmarkApi.list(currentSite!.id, page),
    enabled: !!currentSite,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => bookmarkApi.delete(currentSite!.id, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });

  if (isLoading) return <Typography>Loading...</Typography>;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" mb={2}>
        <Typography variant="h4">Bookmarks</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Bookmark
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.data.items.map((bookmark) => (
              <TableRow key={bookmark.id}>
                <TableCell>{bookmark.title}</TableCell>
                <TableCell>{bookmark.url}</TableCell>
                <TableCell>
                  {new Date(bookmark.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    color="error"
                    onClick={() => deleteMutation.mutate(bookmark.id)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
```

## Step 4: Add the Route

Register the new page in `admin/src/App.tsx`:

```tsx
import BookmarksPage from './pages/BookmarksPage';

// Inside the router configuration:
<Route path="/bookmarks" element={<BookmarksPage />} />
```

## Forms with react-hook-form and zod

For create/edit forms, use react-hook-form with zod schema validation:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const bookmarkSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  url: z.string().url('Must be a valid URL'),
  description: z.string().max(500).optional(),
});

type BookmarkFormData = z.infer<typeof bookmarkSchema>;

function BookmarkForm({ onSubmit }: { onSubmit: (data: BookmarkFormData) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookmarkFormData>({
    resolver: zodResolver(bookmarkSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField
        label="Title"
        {...register('title')}
        error={!!errors.title}
        helperText={errors.title?.message}
        fullWidth
        margin="normal"
      />
      <TextField
        label="URL"
        {...register('url')}
        error={!!errors.url}
        helperText={errors.url?.message}
        fullWidth
        margin="normal"
      />
      <TextField
        label="Description"
        {...register('description')}
        error={!!errors.description}
        helperText={errors.description?.message}
        fullWidth
        multiline
        rows={3}
        margin="normal"
      />
      <Button type="submit" variant="contained">
        Save
      </Button>
    </form>
  );
}
```

## Form Submission with Error Handling

The form example above shows validation, but a complete form also needs submission state, error handling, and success feedback. Here's the full pattern using `useMutation` and `notistack`:

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';

function BookmarkForm({ onClose }: { onClose: () => void }) {
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookmarkFormData>({
    resolver: zodResolver(bookmarkSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: BookmarkFormData) =>
      apiService.createBookmark(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      enqueueSnackbar('Bookmark created', { variant: 'success' });
      onClose();
    },
    onError: () => {
      enqueueSnackbar('Failed to create bookmark', { variant: 'error' });
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => createMutation.mutate(data))}>
      {/* ... form fields ... */}
      <Button
        type="submit"
        variant="contained"
        disabled={createMutation.isPending}
      >
        {createMutation.isPending ? 'Saving...' : 'Save'}
      </Button>
    </form>
  );
}
```

Key patterns:
- **`isPending`** disables the submit button during the request.
- **`onSuccess`** invalidates the query cache so the list refreshes.
- **`enqueueSnackbar`** from notistack shows toast notifications.
- **`onError`** catches API failures and shows an error toast.

## Context Providers

The admin uses React context for cross-cutting state. The most important context is `SiteContext`, which tracks the currently selected site:

```tsx
import { useSiteContext } from '@/store/SiteContext';

function MyComponent() {
  const {
    selectedSiteId,     // current site UUID
    setSelectedSiteId,  // switch sites
    selectedSite,       // full Site object
    sites,              // all sites the user can access
    isLoading,          // true while sites are being fetched
  } = useSiteContext();
}
```

`SiteContext` persists the selected site in `localStorage`, queries available sites via TanStack Query, and filters sites based on the user's role. All site-scoped API calls should use `selectedSiteId` from this context.

Other contexts:
- **`AuthContext`** (`@/store/AuthContext`) -- Clerk user, JWT token, role information.
- **`UserPreferencesContext`** (`@/store/UserPreferencesContext`) -- autosave, page size, UI preferences.

All contexts are provided by the `AllProviders` wrapper in the component tree.

## Testing Components

Admin tests use **Vitest** with **React Testing Library**. The test infrastructure lives in `admin/src/test/`:

- **`setup.ts`** -- Global mocks (Clerk, `matchMedia`, `apiService` with all 150+ methods mocked, `localStorage`, `IntersectionObserver`).
- **`test-utils.tsx`** -- `renderWithProviders()` that wraps components in all necessary context providers.

### Writing a Component Test

```tsx
// admin/src/pages/__tests__/BookmarksPage.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';
import { apiService } from '@/services/api';
import BookmarksPage from '../BookmarksPage';

// apiService is already mocked in setup.ts -- just set return values
vi.mocked(apiService.getBookmarks).mockResolvedValue({
  items: [
    { id: '1', title: 'Rust Book', url: 'https://doc.rust-lang.org/book/', ... },
  ],
  total: 1,
  page: 1,
  per_page: 10,
});

describe('BookmarksPage', () => {
  it('renders the bookmark list', async () => {
    renderWithProviders(<BookmarksPage />);
    expect(await screen.findByText('Rust Book')).toBeInTheDocument();
  });

  it('calls delete on button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BookmarksPage />);

    const deleteButton = await screen.findByTestId('bookmark.btn.delete');
    await user.click(deleteButton);

    expect(apiService.deleteBookmark).toHaveBeenCalledWith('test-site-id', '1');
  });
});
```

Run tests:

```bash
cd admin && npm test                    # watch mode
cd admin && npm test -- --run           # single run
cd admin && npm test -- --run Bookmarks # filter by name
```

### `renderWithProviders` Options

```tsx
renderWithProviders(<MyComponent />, {
  route: '/sites/123/bookmarks',           // set the initial route
  authOverrides: { role: 'viewer' },       // override auth context
  siteOverrides: { selectedSiteId: '456' }, // override site context
});
```

## `data-testid` Convention

All interactive UI elements should have `data-testid` attributes for e2e test selectors. Use dot-separated namespacing:

```tsx
// Pattern: <page>.<element-type>.<name>
<Button data-testid="bookmarks.btn.create" variant="contained">
  Add Bookmark
</Button>

<TextField data-testid="bookmarks.input.title" label="Title" />

<Dialog data-testid="bookmarks.dialog.create">
  {/* ... */}
</Dialog>
```

In tests, query by test ID:

```tsx
const createButton = screen.getByTestId('bookmarks.btn.create');
```

## Block Editor (Tiptap)

The blog content editor uses **Tiptap** with Markdown storage. Components live in `admin/src/components/editor/`:

| File | Purpose |
|------|---------|
| `ForjaEditor.tsx` | Main editor component, configures all Tiptap extensions |
| `EditorToolbar.tsx` | Formatting toolbar (bold, italic, headings, lists, code, etc.) |
| `SlashCommandMenu.tsx` | Slash command popup menu for inserting blocks |
| `ImagePickerExtension.ts` | Custom Tiptap extension that integrates with the media library |
| `types.ts` | Type augmentation for custom Tiptap commands |

The editor stores content as **Markdown** via the `tiptap-markdown` extension. When reading editor content:

```tsx
const md = ((editor.storage as any).markdown as MarkdownStorage).getMarkdown();
```

The `editor.storage` type from Tiptap maps to DOM `Storage`, so accessing extension storage requires a cast via `any`.

## Development Proxy

In development, the admin runs on `localhost:3000` and proxies API requests to the backend at `localhost:8000`. This is configured in `admin/vite.config.ts`.

## Running the Admin

```bash
cd admin
npm install
npm run dev
```

The admin dashboard is available at `http://localhost:3000`.

## Building for Production

The admin builds to `backend/static/dashboard/`, which is served by the Rust backend at `/dashboard`:

```bash
cd admin
npm run build
```

The Dockerfile handles this automatically during the multi-stage build.
