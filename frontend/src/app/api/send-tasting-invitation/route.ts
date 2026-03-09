import { z } from 'zod';
import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import twilio from 'twilio';
import * as lark from '@larksuiteoapi/node-sdk';

// Request schema for sending tasting invitations
const SendTastingInvitationSchema = z.object({
  session_id: z.number().int().positive(),
  session_name: z.string().min(1),
  session_date: z.string(),
  formatted_date: z.string().optional(),
  session_location: z.string().optional().nullable(),
  recipients: z.array(z.object({
    email: z.string().email(),
    username: z.string().optional(),
    phone_number: z.string().nullable().optional(),
  })).min(1),
  message: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("body",body)

    // Validate request
    const validatedData = SendTastingInvitationSchema.parse(body);

    // Skip sending invitations if the session date is in the past
    const sessionDate = new Date(validatedData.session_date);
    console.log("sessionDate",sessionDate)
    if (sessionDate < new Date()) {
      return Response.json({
        success: true,
        message: 'Session is in the past — invitations not sent',
        email_count: 0,
        sms_count: 0,
        lark_count: 0,
        recipient_count: validatedData.recipients.length,
      });
    }

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

    // Use pre-formatted date from the frontend (avoids server timezone issues)
    const formattedDate = validatedData.formatted_date ?? validatedData.session_date;

    const logoUrl = `${appUrl}/logo/Reciperep%20logo%20inline%20840x180.png`;

    const buildEmailHtml = (recipientName?: string) => {
    const displayName = recipientName ? escapeHtml(recipientName) : '';
    const greetingHtml = displayName
      ? `You're invited,<br/><span style="color: #c0431a; font-style: normal;">${displayName}.</span>`
      : `You're invited.`;

    const locationRow = validatedData.session_location ? `
                                    <tr>
                                      <td style="padding: 0;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                                          <td valign="top" style="width: 32px; padding-right: 14px;">
                                            <div style="width: 32px; height: 32px; background: #fff; border-radius: 8px; text-align: center; line-height: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
                                              <img src="https://img.icons8.com/material-outlined/30/c0431a/marker.png" alt="" width="15" height="15" style="vertical-align: middle;" />
                                            </div>
                                          </td>
                                          <td valign="top">
                                            <div style="font-size: 10px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: #c0431a; margin-bottom: 3px;">Location</div>
                                            <div style="font-size: 15px; font-weight: 500; color: #1a1a1a; line-height: 1.4;">${escapeHtml(validatedData.session_location)}</div>
                                          </td>
                                        </tr></table>
                                      </td>
                                    </tr>` : '';

    const customMessageHtml = validatedData.message ? `
                        <tr>
                          <td style="padding: 20px 0 0 0;">
                            <p style="margin: 0; font-size: 15px; color: #555; line-height: 1.6; font-style: italic; border-left: 3px solid #ede8e0; padding-left: 16px;">
                              ${escapeHtml(validatedData.message)}
                            </p>
                          </td>
                        </tr>` : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>You're Invited – RecipePrep Tasting Session</title>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
        </head>
        <body style="margin: 0; padding: 0; background-color: #f0ebe3; font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; -webkit-font-smoothing: antialiased;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0ebe3;">
            <tr>
              <td align="center" style="padding: 40px 16px;">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">

                  <!-- Header with logo -->
                  <tr>
                    <td style="background: #fff; border-radius: 16px 16px 0 0; padding: 28px 40px 24px; text-align: center; border-bottom: 1px solid #ede8e0;">
                      <img src="${logoUrl}" alt="RecipePrep" width="180" style="display: block; margin: 0 auto; max-width: 180px; height: auto;" />
                    </td>
                  </tr>

                  <!-- Hero band -->
                  <tr>
                    <td style="background: #c0431a; padding: 6px 0; text-align: center;">
                      <p style="margin: 0; font-size: 11px; font-weight: 500; letter-spacing: 2.5px; text-transform: uppercase; color: #fde8de;">Tasting Session Invitation</p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="background: #fff; padding: 44px 40px 36px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                        <!-- Greeting -->
                        <tr>
                          <td style="padding-bottom: 16px;">
                            <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: 700; line-height: 1.2; color: #1a1a1a;">
                              ${greetingHtml}
                            </h1>
                          </td>
                        </tr>

                        <!-- Intro -->
                        <tr>
                          <td style="padding-bottom: 36px;">
                            <p style="margin: 0; font-size: 15px; font-weight: 300; line-height: 1.7; color: #555;">
                              We'd love to have you join us for an exclusive tasting session on <strong>RecipePrep</strong> — your feedback helps us craft something truly delicious. See the details below and save your spot.
                            </p>
                          </td>
                        </tr>

                        <!-- Session card -->
                        <tr>
                          <td style="padding-bottom: 36px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #faf7f2; border-radius: 12px; border-left: 4px solid #c0431a;">
                              <tr>
                                <td style="padding: 28px 28px 24px;">
                                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                                    <!-- Session name -->
                                    <tr>
                                      <td style="padding-bottom: 20px;">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                                          <td valign="top" style="width: 32px; padding-right: 14px;">
                                            <div style="width: 32px; height: 32px; background: #fff; border-radius: 8px; text-align: center; line-height: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
                                              <img src="https://img.icons8.com/material-outlined/30/c0431a/menu.png" alt="" width="15" height="15" style="vertical-align: middle;" />
                                            </div>
                                          </td>
                                          <td valign="top">
                                            <div style="font-size: 10px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: #c0431a; margin-bottom: 3px;">Session</div>
                                            <div style="font-size: 15px; font-weight: 500; color: #1a1a1a; line-height: 1.4;">${escapeHtml(validatedData.session_name)}</div>
                                          </td>
                                        </tr></table>
                                      </td>
                                    </tr>

                                    <!-- Date & time -->
                                    <tr>
                                      <td style="padding-bottom: ${validatedData.session_location ? '20px' : '0'};">
                                        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                                          <td valign="top" style="width: 32px; padding-right: 14px;">
                                            <div style="width: 32px; height: 32px; background: #fff; border-radius: 8px; text-align: center; line-height: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
                                              <img src="https://img.icons8.com/material-outlined/30/c0431a/calendar.png" alt="" width="15" height="15" style="vertical-align: middle;" />
                                            </div>
                                          </td>
                                          <td valign="top">
                                            <div style="font-size: 10px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: #c0431a; margin-bottom: 3px;">Date &amp; Time</div>
                                            <div style="font-size: 15px; font-weight: 500; color: #1a1a1a; line-height: 1.4;">${formattedDate}</div>
                                          </td>
                                        </tr></table>
                                      </td>
                                    </tr>

                                    <!-- Location (conditional) -->
                                    ${locationRow}

                                  </table>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        ${customMessageHtml}

                        <!-- Divider -->
                        <tr>
                          <td style="padding-bottom: 28px;">
                            <div style="height: 1px; background: linear-gradient(to right, transparent, #e5ddd4, transparent);"></div>
                          </td>
                        </tr>

                        <!-- CTA -->
                        <tr>
                          <td align="center">
                            <a href="${escapeHtml(inviteLink)}" style="display: inline-block; background: #c0431a; color: #fff; text-decoration: none; font-size: 15px; font-weight: 500; letter-spacing: 0.3px; padding: 16px 44px; border-radius: 50px;">
                              View Tasting Session &rarr;
                            </a>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top: 18px;">
                            <p style="margin: 0; font-size: 13px; color: #999; font-weight: 300;">
                              Or copy this link: <a href="${escapeHtml(inviteLink)}" style="color: #c0431a; text-decoration: none; font-weight: 400; word-break: break-all;">${escapeHtml(inviteLink)}</a>
                            </p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background: #f5f0e8; border-radius: 0 0 16px 16px; padding: 22px 40px; text-align: center; border-top: 1px solid #ede8e0;">
                      <p style="margin: 0; font-size: 12px; color: #aaa; font-weight: 300; line-height: 1.8;">
                        This is an automated message from RecipePrep. Please do not reply to this email.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;
    };

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
      html: buildEmailHtml(recipient.username),
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

    // Initialize Lark for DMs (if configured)
    let larkCount = 0;
    const larkSends: Promise<unknown>[] = [];

    const larkAppId = process.env.LARK_APP_ID;
    const larkAppSecret = process.env.LARK_APP_SECRET;

    console.log('[Lark] LARK_APP_ID configured:', !!larkAppId, 'LARK_APP_SECRET configured:', !!larkAppSecret);

    if (larkAppId && larkAppSecret && validatedData.recipients.length > 0) {
      try {
        const larkClient = new lark.Client({
          appId: larkAppId,
          appSecret: larkAppSecret,
          appType: lark.AppType.SelfBuild,
          domain: lark.Domain.Lark,
        });

        // Build Lark Calendar applink — clicking opens the event creation page pre-filled
        const startTimestamp = Math.floor(sessionDate.getTime() / 1000);
        const endTimestamp = startTimestamp + 3600; // +1 hour
        const calendarSummary = encodeURIComponent(`Tasting: ${validatedData.session_name}`);
        const calendarLink = `https://applink.larksuite.com/client/calendar/event/create?startTime=${startTimestamp}&endTime=${endTimestamp}&summary=${calendarSummary}`;

        const larkText = `${smsText}\n\n📅 Add to your Lark Calendar: ${calendarLink}`;

        console.log('[Lark] Sending to', validatedData.recipients.length, 'recipients');

        // Send Lark messages sequentially to avoid token acquisition race conditions
        larkSends.push(
          (async () => {
            for (const recipient of validatedData.recipients) {
              try {
                const res = await larkClient.im.message.create({
                  params: { receive_id_type: 'email' },
                  data: {
                    receive_id: recipient.email,
                    msg_type: 'text',
                    content: JSON.stringify({ text: larkText }),
                  },
                });
                console.log(`[Lark] Message sent to ${recipient.email}:`, JSON.stringify(res));
                larkCount++;
              } catch (err) {
                console.error(`[Lark] Message failed for ${recipient.email}:`, JSON.stringify(err, null, 2));
              }
            }
          })()
        );
      } catch (error) {
        console.error('[Lark] Initialization error:', error);
        // Continue with email/SMS sending even if Lark fails
      }
    } else {
      console.log('[Lark] Skipped — not configured or no recipients');
    }

    // Send emails, SMS, and Lark in parallel
    const sendPromises: Promise<unknown>[] = [];

    if (emailMessages.length > 0) {
      sendPromises.push(sgMail.send(emailMessages));
    }

    sendPromises.push(...twilioSends);
    sendPromises.push(...larkSends);

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
    if (larkCount > 0) {
      summary.push(`${larkCount} Lark message(s)`);
    }

    return Response.json({
      success: true,
      message: `Invitations sent via ${summary.join(' and ')}`,
      email_count: emailMessages.length,
      sms_count: smsCount,
      lark_count: larkCount,
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
