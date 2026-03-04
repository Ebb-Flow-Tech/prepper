'use client';

import { useState, useCallback } from 'react';
import { useCreateUser, useOutlets } from '@/lib/hooks';
import { Button, Input, Select, Modal } from '@/components/ui';
import { toast } from 'sonner';
import type { UserType } from '@/types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const USER_TYPE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'admin', label: 'Admin' },
];

export function AddUserModal({ isOpen, onClose }: AddUserModalProps) {
  const createUser = useCreateUser();
  const { data: outletsData } = useOutlets({ page_size: 30 });
  const outlets = outletsData?.items ?? [];

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userType, setUserType] = useState<UserType>('normal');
  const [outletId, setOutletId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setEmail('');
    setUsername('');
    setPassword('');
    setPhoneNumber('');
    setUserType('normal');
    setOutletId('');
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
      await createUser.mutateAsync({
        email: email.trim(),
        username: username.trim(),
        password: password.trim(),
        phone_number: phoneNumber || undefined,
        user_type: userType,
        outlet_id: outletId ? parseInt(outletId) : null,
      });

      toast.success('User created successfully');
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
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Email *
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Username *
          </label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="johndoe"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
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
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Phone Number (optional)
          </label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            User Type
          </label>
          <Select
            value={userType}
            onChange={(e) => setUserType(e.target.value as UserType)}
            options={USER_TYPE_OPTIONS}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Branch (optional)
          </label>
          <select
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- None --</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.id}>
                {outlet.name}
              </option>
            ))}
          </select>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
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
