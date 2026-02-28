---
sidebar_position: 3
---

# Admin Dashboard Development Guide

This guide explains how to add new features to the OpenYapper React admin dashboard. The admin is built with Vite, Material UI, React Query, react-hook-form, and zod.

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
import { useSiteContext } from '../contexts/SiteContext';

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

## Development Proxy

In development, the admin runs on `localhost:5173` and proxies API requests to the backend at `localhost:8000`. This is configured in `admin/vite.config.ts`.

## Running the Admin

```bash
cd admin
npm install
npm run dev
```

The admin dashboard is available at `http://localhost:5173`.

## Building for Production

The admin builds to `backend/static/dashboard/`, which is served by the Rust backend at `/dashboard`:

```bash
cd admin
npm run build
```

The Dockerfile handles this automatically during the multi-stage build.
