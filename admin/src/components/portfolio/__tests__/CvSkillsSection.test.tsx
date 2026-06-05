import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import CvSkillsSection from '../CvSkillsSection';
import type { SkillResponse } from '@/types/api';

const mockSkills: SkillResponse[] = [
  { id: '1', name: 'Rust', slug: 'rust', category: 'Programming', proficiency_level: 5, localizations: [] },
  { id: '2', name: 'TypeScript', slug: 'typescript', category: 'Programming', proficiency_level: 3, localizations: [] },
  { id: '3', name: 'Docker', slug: 'docker', category: 'Devops', proficiency_level: 1, localizations: [] },
  { id: '4', name: 'React', slug: 'react', category: 'Framework', localizations: [] },
];

const defaultProps = {
  skills: mockSkills,
  meta: { total_items: 4, page: 1, page_size: 25 },
  loading: false,
  error: null,
  page: 1,
  rowsPerPage: 25,
  canWrite: true,
  isAdmin: true,
  onPage: () => {},
  onPerPage: () => {},
  onOpenCreate: () => {},
  onEdit: () => {},
  onDelete: () => {},
  searchValue: '',
  onSearchChange: () => {},
  sortBy: 'name',
  sortDir: 'asc' as const,
  onSort: () => {},
};

describe('CvSkillsSection', () => {
  it('renders proficiency as star ratings, not raw percentages', () => {
    renderWithProviders(<CvSkillsSection {...defaultProps} />);

    // Should NOT display raw percentages
    expect(screen.queryByText('5%')).not.toBeInTheDocument();
    expect(screen.queryByText('3%')).not.toBeInTheDocument();
    expect(screen.queryByText('1%')).not.toBeInTheDocument();
  });

  it('renders accessible star rating with aria-label for each proficiency level', () => {
    renderWithProviders(<CvSkillsSection {...defaultProps} />);

    // Proficiency 5 should have an accessible label like "5 Stars"
    expect(screen.getByLabelText('5 Stars')).toBeInTheDocument();
    // Proficiency 3
    expect(screen.getByLabelText('3 Stars')).toBeInTheDocument();
    // Proficiency 1
    expect(screen.getByLabelText('1 Star')).toBeInTheDocument();
  });

  it('renders dash for skills without proficiency level', () => {
    renderWithProviders(<CvSkillsSection {...defaultProps} />);

    // React has no proficiency_level — should show dash
    const cells = screen.getAllByRole('cell');
    const dashCells = cells.filter(cell => cell.textContent === '\u2014');
    expect(dashCells.length).toBeGreaterThan(0);
  });
});
