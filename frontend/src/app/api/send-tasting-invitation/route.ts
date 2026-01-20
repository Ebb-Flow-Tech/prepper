import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';

// Request schema for sending tasting invitations
const SendTastingInvitationSchema = z.object({
  session_id: z.number().int().positive(),
  session_name: z.string().min(1),
  session_date: z.string(),
  session_location: z.string().optional().nullable(),
  recipients: z.array(z.string().email()).min(1),
  message: z.string().optional(),
});

type SendTastingInvitationRequest = z.infer<typeof SendTastingInvitationSchema>;

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

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              Please log in to RecipePrep to view session details and submit your tasting notes.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />

            <p style="font-size: 12px; color: #999;">
              This is an automated message from RecipePrep. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    // Create email messages for each recipient
    const messages: MailDataRequired[] = validatedData.recipients.map((email) => ({
      to: email,
      from: {
        email: senderEmail,
        name: senderName,
      },
      subject: `Invited: ${validatedData.session_name}`,
      html: emailHtml,
    }));

    // Send emails via SendGrid SDK
    await sgMail.send(messages);

    return Response.json({
      success: true,
      message: `Invitations sent to ${validatedData.recipients.length} recipient(s)`,
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
