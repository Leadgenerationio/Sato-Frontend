import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Verifies the FileUpload component is mounted on the staff-detail Documents
// tab with the `misc` folder prop. Pattern mirrors file-upload.test.tsx: when
// a file is selected on the rendered input, useFileUpload.mutateAsync gets
// called with the folder string the parent passed in — that's the cleanest
// way to assert the prop without snapshotting the whole DOM.

const uploadMutateAsyncMock = vi.fn();
const addStaffDocMock = vi.fn();
const removeStaffDocMock = vi.fn();

vi.mock('@/lib/hooks/use-uploads', () => ({
  useFileUpload: () => ({
    mutateAsync: uploadMutateAsyncMock,
    isPending: false,
    isError: false,
  }),
  fetchFreshDownloadUrl: vi.fn(),
}));

vi.mock('@/lib/hooks/use-staff', () => ({
  useStaffMember: () => ({
    data: {
      id: 's-1',
      name: 'Sam Carter',
      email: 'sam@leadgeneration.io',
      role: 'Managing Director',
      department: 'Operations',
      startDate: '2020-01-15',
      status: 'active',
      holidaysRemaining: 18,
      holidaysTaken: 7,
    },
    isLoading: false,
    error: null,
  }),
  useHolidayRequests: () => ({ data: [], isLoading: false, error: null }),
  useStaffDocuments: () => ({ data: [], isLoading: false }),
  useAddStaffDocument: () => ({ mutateAsync: addStaffDocMock, isPending: false }),
  useRemoveStaffDocument: () => ({ mutateAsync: removeStaffDocMock, isPending: false }),
  // Anything imported by the staff index module (because StaffDocumentsTab
  // lives there) needs a stub to avoid runtime errors when the module is
  // loaded transitively.
  useStaffList: () => ({ data: [], isLoading: false }),
  useStaffStats: () => ({ data: null, isLoading: false }),
  useJobPostings: () => ({ data: [], isLoading: false }),
  useApplicants: () => ({ data: [], isLoading: false }),
  useApproveHolidayRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useRejectHolidayRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStaff: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateStaff: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateJobPosting: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateHolidayRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

import { StaffDetailPage } from '../pages/staff/detail';
import { StaffDocumentsTab } from '../pages/staff/index';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/staff/s-1']}>
        <Routes>
          <Route path="/staff/:id" element={<StaffDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderDocsTabDirectly(staffId = 's-1') {
  // Radix Tabs only render the active tab's content, so to interact with the
  // FileUpload inside the documents tab from a jsdom test we render the same
  // StaffDocumentsTab component that the page mounts. Asserting prop wiring
  // here is equivalent — the page just passes the URL `id` through unchanged.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StaffDocumentsTab staffId={staffId} />
    </QueryClientProvider>,
  );
}

describe('StaffDetailPage — Documents tab', () => {
  beforeEach(() => {
    uploadMutateAsyncMock.mockReset();
    addStaffDocMock.mockReset();
    removeStaffDocMock.mockReset();
  });

  it('renders the Documents tab trigger alongside the other tabs', () => {
    renderPage();
    // Tabs are Statto segmented buttons (.seg-btn), not ARIA tabs.
    expect(screen.getByRole('button', { name: /documents/i })).toBeInTheDocument();
  });

  it('mounts FileUpload with folder="misc" on the Documents tab', async () => {
    uploadMutateAsyncMock.mockResolvedValueOnce({
      key: 'staff-docs/contract.pdf',
      folder: 'misc',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      configured: true,
      uploadUrl: 'https://signed/up',
      downloadUrl: 'https://signed/dl',
    });

    renderDocsTabDirectly();

    const input = screen.getByTestId('file-upload-input');
    const file = new File(['contract-bytes'], 'contract.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploadMutateAsyncMock).toHaveBeenCalledTimes(1));
    // Asserts the prop the parent passed in: folder=misc reaches the upload hook.
    expect(uploadMutateAsyncMock.mock.calls[0][0]).toEqual({ file, folder: 'misc' });
  });
});
