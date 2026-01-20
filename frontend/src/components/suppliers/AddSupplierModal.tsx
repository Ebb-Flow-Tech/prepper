'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, MapPin, Phone, Mail } from 'lucide-react';
import { useCreateSupplier } from '@/lib/hooks';
import { Button, Input, Modal } from '@/components/ui';
import { toast } from 'sonner';

interface AddSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddSupplierModal({ isOpen, onClose }: AddSupplierModalProps) {
  const createSupplier = useCreateSupplier();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setAddress('');
    setPhone('');
    setEmail('');
    setShowMoreInfo(false);
    setIsSubmitting(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Supplier name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      await createSupplier.mutateAsync({
        name: name.trim(),
        address: address.trim() || undefined,
        phone_number: phone.trim() || undefined,
        email: email.trim() || undefined,
      });

      toast.success('Supplier created');
      resetForm();
      onClose();
    } catch {
      toast.error('Failed to create supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Supplier">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Supplier Name */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            Supplier Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Fresh Farms Inc."
            autoFocus
          />
        </div>

        {/* More Information Dropdown */}
        <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4">
          <button
            type="button"
            onClick={() => setShowMoreInfo(!showMoreInfo)}
            className="flex items-center justify-between w-full text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <span>More Information</span>
            {showMoreInfo ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showMoreInfo && (
            <div className="mt-4 space-y-3">
              {/* Phone Number */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Phone Number
                </label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g., +65 1234 5678"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-zinc-400 shrink-0" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g., contact@supplier.com"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Address
                </label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g., 123 Main Street, Singapore"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? 'Creating...' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
