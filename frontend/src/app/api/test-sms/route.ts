import twilio from 'twilio';

/**
 * Test endpoint for SMS integration
 * Sends a sample tasting invitation SMS
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone_number } = body;

    if (!phone_number) {
      return Response.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Check if Twilio is configured
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
      return Response.json(
        { error: 'Twilio not configured' },
        { status: 503 }
      );
    }

    // Sample tasting invitation message
    const sessionName = 'Winter Menu Tasting';
    const sessionDate = 'Friday, March 7, 2026 at 02:00 PM';
    const sessionLocation = 'Main Kitchen';
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/tastings/invite/1`;

    const smsText = `You're invited to a tasting session: "${sessionName}" on ${sessionDate} at ${sessionLocation}. Join here: ${inviteLink}`;

    // Initialize Twilio client
    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

    // Send SMS
    const message = await twilioClient.messages.create({
      body: smsText,
      from: twilioFromNumber,
      to: phone_number,
    });

    return Response.json({
      success: true,
      message: `Test SMS sent successfully to ${phone_number}`,
      sms_sid: message.sid,
      status: message.status,
      body: smsText,
    });
  } catch (error) {
    console.error('Failed to send test SMS:', error);

    if (error instanceof Error) {
      // Check for common Twilio errors
      if (error.message.includes('Account SID')) {
        return Response.json(
          { error: 'Invalid Twilio Account SID' },
          { status: 401 }
        );
      }
      if (error.message.includes('Auth Token')) {
        return Response.json(
          { error: 'Invalid Twilio Auth Token' },
          { status: 401 }
        );
      }
      if (error.message.includes('Invalid phone number')) {
        return Response.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }

      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json(
      { error: 'Failed to send test SMS' },
      { status: 500 }
    );
  }
}
