import { downloadImagesAsPdf } from '../utils/downloadImagesPdf';

// Mock jsPDF
jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } },
    addPage: jest.fn(),
    addImage: jest.fn(),
    save: jest.fn(),
  }));
});

describe('downloadImagesAsPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:test');
    global.URL.revokeObjectURL = jest.fn();
  });

  it('should throw error when no image files', async () => {
    const files = [{ type: 'application/pdf', url: '/test.pdf' }];
    await expect(downloadImagesAsPdf(files, 'test')).rejects.toThrow('No image files found');
  });

  it('should throw error when files array is empty', async () => {
    await expect(downloadImagesAsPdf([], 'test')).rejects.toThrow('No image files found');
  });

  it('should process image files', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: jest.fn().mockResolvedValue(new Blob()),
    });

    const img = {
      naturalWidth: 800,
      naturalHeight: 600,
      width: 800,
      height: 600,
      decode: jest.fn().mockResolvedValue(undefined),
      onload: null,
      onerror: null,
    };
    global.Image = jest.fn().mockImplementation(() => img);

    const files = [
      { type: 'image/jpeg', url: '/test1.jpg' },
      { type: 'image/png', url: '/test2.png' },
    ];

    // Trigger image load immediately
    setTimeout(() => {
      if (img.onload) img.onload();
    }, 0);

    const result = downloadImagesAsPdf(files, 'test-paper');
    await expect(result).resolves.not.toThrow();
  });
});
