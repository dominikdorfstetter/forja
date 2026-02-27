import { Box } from '@mui/material';
import BlogCategoryCard from '@/components/blogs/BlogCategoryCard';
import BlogDocumentCard from '@/components/blogs/BlogDocumentCard';
import type { Category, BlogDocumentResponse } from '@/types/api';

interface BlogAttachmentsTabProps {
  contentId: string;
  blogId: string;
  categories: Category[];
  documents: BlogDocumentResponse[];
}

export default function BlogAttachmentsTab({
  contentId,
  blogId,
  categories,
  documents,
}: BlogAttachmentsTabProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <BlogCategoryCard contentId={contentId} categories={categories} />
      <BlogDocumentCard blogId={blogId} documents={documents} />
    </Box>
  );
}
