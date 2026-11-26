import { downloadImagesAsPdf } from '../utils/downloadImagesPdf';
import { vi } from 'vitest';

// Mock jsPDF
vi.mock('jspdf', () => {
  return { jsPDF: vi.fn(function MockJsPdf() {
    this.internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
    this.addPage = vi.fn();
    this.addImage = vi.fn();
    this.save = vi.fn();
  }) };
});

describe('downloadImagesAsPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('should throw error when no image files', async () => {
    const files = [{ type: 'application/pdf', url: '/test.pdf' }];
    await expect(downloadImagesAsPdf(files, 'test')).rejects.toThrow('No image files found');
  });

  it('should throw error when files array is empty', async () => {
    await expect(downloadImagesAsPdf([], 'test')).rejects.toThrow('No image files found');
  });

  it('should process image files', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob()),
    });

    const img = {
      naturalWidth: 800,
      naturalHeight: 600,
      width: 800,
      height: 600,
      decode: vi.fn().mockResolvedValue(undefined),
      onload: null,
      onerror: null,
    };
    global.Image = vi.fn(function MockImage() { return img; });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,test');

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
