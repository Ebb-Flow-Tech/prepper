import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import twilio from 'twilio';

// Request schema for sending tasting invitations
const SendTastingInvitationSchema = z.object({
  session_id: z.number().int().positive(),
  session_name: z.string().min(1),
  session_date: z.string(),
  session_location: z.string().optional().nullable(),
  recipients: z.array(z.object({
    email: z.string().email(),
    phone_number: z.string().nullable().optional(),
  })).min(1),
  message: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request
    const validatedData = SendTastingInvitationSchema.parse(body);

    // Check if SendGrid is configured
    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    const senderEmail = process.env.SENDER_EMAIL;
    const senderName = process.env.SENDER_NAME || 'RecipePrep';
    if (!sendGridApiKey || !senderEmail) {
      return Response.json(
        { error: 'Email service not configured' },
        { status: 503 }
      );
    }

    // Initialize SendGrid with API key
    sgMail.setApiKey(sendGridApiKey);

    // Build invite link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const inviteLink = `${appUrl}/tastings/invite/${validatedData.session_id}`;

    // Format the date nicely
    const formattedDate = new Date(validatedData.session_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Build the email content
    const locationText = validatedData.session_location
      ? `<p><strong>Location:</strong> ${escapeHtml(validatedData.session_location)}</p>`
      : '';

    const customMessage = validatedData.message
      ? `<p>${escapeHtml(validatedData.message)}</p>`
      : '';

    const emailHtml = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">You're Invited to a Tasting Session</h2>

            <p>Hello,</p>

            <p>You have been invited to participate in a tasting session on <strong>RecipePrep</strong>.</p>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Session:</strong> ${escapeHtml(validatedData.session_name)}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              ${locationText}
            </div>

            ${customMessage}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${escapeHtml(inviteLink)}" style="background-color: #2c3e50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Tasting Session
              </a>
            </div>

            <p style="color: #666; font-size: 14px; text-align: center; margin: 20px 0;">
              Or copy this link: ${escapeHtml(inviteLink)}
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

            <p style="font-size: 12px; color: #999;">
              This is an automated message from RecipePrep. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    // Separate recipients by channel (email vs SMS)
    const emailRecipients = validatedData.recipients.filter((r) => r.email);
    const smsRecipients = validatedData.recipients.filter((r) => r.phone_number);

    // Create email messages for email recipients
    const emailMessages: MailDataRequired[] = emailRecipients.map((recipient) => ({
      to: recipient.email,
      from: {
        email: senderEmail,
        name: senderName,
      },
      subject: `Invited: ${validatedData.session_name}`,
      html: emailHtml,
    }));

    // Build SMS message
    const locationSuffix = validatedData.session_location ? ` at ${validatedData.session_location}` : '';
    const smsText = `You're invited to a tasting session: "${validatedData.session_name}" on ${formattedDate}${locationSuffix}. Join here: ${inviteLink}`;

    // Initialize Twilio for SMS (if configured)
    let smsCount = 0;
    const twilioSends: Promise<unknown>[] = [];

    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

    if (twilioAccountSid && twilioAuthToken && twilioFromNumber && smsRecipients.length > 0) {
      try {
        const twilioClient = twilio(twilioAccountSid, twilioAuthToken);
        smsRecipients.forEach((recipient) => {
          if (recipient.phone_number) {
            twilioSends.push(
              twilioClient.messages.create({
                body: smsText,
                from: twilioFromNumber,
                to: recipient.phone_number,
              })
            );
            smsCount++;
          }
        });
      } catch (error) {
        console.error('Twilio initialization error:', error);
        // Continue with email sending even if Twilio fails
      }
    }

    // Send emails and SMS in parallel
    const sendPromises: Promise<unknown>[] = [];

    if (emailMessages.length > 0) {
      sendPromises.push(sgMail.send(emailMessages));
    }

    sendPromises.push(...twilioSends);

    if (sendPromises.length > 0) {
      await Promise.all(sendPromises);
    }

    const summary = [];
    if (emailMessages.length > 0) {
      summary.push(`${emailMessages.length} email(s)`);
    }
    if (smsCount > 0) {
      summary.push(`${smsCount} SMS`);
    }

    return Response.json({
      success: true,
      message: `Invitations sent via ${summary.join(' and ')}`,
      email_count: emailMessages.length,
      sms_count: smsCount,
      recipient_count: validatedData.recipients.length,
    });
  } catch (error) {
    console.error('Failed to send tasting invitations:', error);

    if (error instanceof z.ZodError) {
      return Response.json(
        { error: 'Invalid request data' },
        // { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return Response.json(
          { error: 'Email service not configured' },
          { status: 503 }
        );
      }
    }

    return Response.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
