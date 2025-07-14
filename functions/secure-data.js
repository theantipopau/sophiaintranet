export async function onRequest(context) {
  const url = new URL(context.request.url);
  const fileName = url.pathname.split('/').pop();

  // Enhanced security - validate file extension
  if (!fileName.endsWith('.csv')) {
    return new Response('Invalid file type', { status: 400 });
  }

  // Sanitize filename to prevent directory traversal
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '');

  const allowedFiles = [
    'Barcodelocations.csv',
    'BCEteacherinfo.csv', 
    'BehaviourList.csv',
    'housecompanions.csv',
    'infringements.csv',
    'Learningareacategory.csv',
    'outofclass.csv',
    'parentemail.csv',
    'staffid.csv',
    'students.csv'
  ];

  if (!allowedFiles.includes(sanitizedFileName)) {
    console.warn(`Unauthorized file access attempt: ${fileName}`);
    return new Response('File not found', { status: 404 });
  }

  try {
    const filePath = `data/${sanitizedFileName}`; // Updated path
    const fileResponse = await context.env.ASSETS.fetch(new URL(filePath, url).toString());

    if (fileResponse.ok) {
      return new Response(fileResponse.body, {
        headers: { 
          'Content-Type': 'text/csv',
          'Cache-Control': 'public, max-age=300' // 5 minute cache
        },
      });
    } else {
      return new Response('File not found in assets', { status: 404 });
    }
  } catch (error) {
    console.error('File serve error:', error);
    return new Response('Error fetching file', { status: 500 });
  }
}
