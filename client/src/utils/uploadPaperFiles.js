import axios from 'axios';

export async function uploadPaperFiles(files) {
  const { data } = await axios.post('/api/papers/upload-urls', {
    files: files.map((file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })),
  });

  if (!Array.isArray(data.uploads) || data.uploads.length !== files.length) {
    throw new Error('Unable to prepare file uploads');
  }

  return Promise.all(data.uploads.map(async (upload, index) => {
    const response = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': files[index].type || 'application/octet-stream' },
      body: files[index],
    });
    if (!response.ok) {
      throw new Error(`Storage upload failed (${response.status})`);
    }
    return {
      filename: upload.filename,
      original_name: files[index].name,
      file_type: files[index].type,
      file_size: files[index].size,
    };
  }));
}
