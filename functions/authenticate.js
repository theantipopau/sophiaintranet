export async function onRequest(context) {
  // Only allow POST requests
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { staffId } = await context.request.json();

    if (!staffId || !/^\d{6}$/.test(staffId)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid Staff ID format.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the staffid.csv file from the secure assets
    const fileResponse = await context.env.ASSETS.fetch(new URL('secure-data/staffid.csv', context.request.url).toString());

    if (!fileResponse.ok) {
      throw new Error('Staff ID file not found.');
    }

    const csvText = await fileResponse.text();
    const lines = csvText.split('\n').slice(1); // Skip header row

    let staffMember = null;
    for (const line of lines) {
      const [name, id, admin] = line.split(',').map(s => s.trim());
      if (id === staffId) {
        staffMember = {
          'staff name': name,
          'staffid': id,
          'adminaccess': admin,
        };
        break;
      }
    }

    if (staffMember) {
      // Fetch teacher info to find the email
      const teacherInfoResponse = await context.env.ASSETS.fetch(new URL('secure-data/BCEteacherinfo.csv', context.request.url).toString());
      let staffEmail = 'unknown@sophiacollege.qld.edu.au';

      if (teacherInfoResponse.ok) {
        const teacherCsvText = await teacherInfoResponse.text();
        const teacherLines = teacherCsvText.split('\n').slice(1);
        for (const line of teacherLines) {
          const [fullName, email] = line.split(',').map(s => s.trim());
          if (fullName === staffMember['staff name']) {
            staffEmail = email;
            break;
          }
        }
      }

      staffMember.email = staffEmail;

      return new Response(JSON.stringify({ success: true, staff: staffMember }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ success: false, message: 'Invalid Staff ID.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return new Response(JSON.stringify({ success: false, message: 'An internal error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
