'use client';

import { useState, useCallback } from 'react';
import { useCreateUser, useUpdateUser } from '@/lib/hooks';
import { Button, Input, Modal } from '@/components/ui';
import { toast } from 'sonner';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Creates a login account. It grants nothing: a new account holds no role anywhere until someone
 * assigns one AT A BRAND in the Brand Roles tab, which writes back to Passport.
 */
export function AddUserModal({ isOpen, onClose }: AddUserModalProps) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setEmail('');
    setUsername('');
    setPassword('');
    setPhoneNumber('');
    setIsSubmitting(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!username.trim()) {
      toast.error('Username is required');
      return;
    }
    if (!password.trim()) {
      toast.error('Password is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = await createUser.mutateAsync({
        email: email.trim(),
        username: username.trim(),
        password: password.trim(),
      });

      // Registration only takes credentials; the phone number is a profile field set afterwards.
      if (phoneNumber.trim()) {
        await updateUser.mutateAsync({
          userId: created.user.id,
          data: { phone_number: phoneNumber.trim() },
        });
      }

      toast.success('User created. Assign a brand role in the Brand Roles tab.');
      resetForm();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New User">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Email *
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Username *
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="johndoe"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Password *
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Phone Number (optional)
          </label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Roles and brand access are assigned in the Brand Roles tab — Prepper does not set them.
        </p>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !email.trim() || !username.trim() || !password.trim()}
          >
            {isSubmitting ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
