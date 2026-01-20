import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SendTastingInvitationPayload {
  session_id: number;
  session_name: string;
  session_date: string;
  session_location?: string | null;
  recipients: string[];
  message?: string;
}

interface SendTastingInvitationResponse {
  success: boolean;
  message: string;
  recipient_count: number;
}

async function sendTastingInvitation(
  payload: SendTastingInvitationPayload
): Promise<SendTastingInvitationResponse> {
  const response = await fetch('/api/send-tasting-invitation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send invitations');
  }

  return response.json();
}

export function useSendTastingInvitation() {
  return useMutation({
    mutationFn: sendTastingInvitation,
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
