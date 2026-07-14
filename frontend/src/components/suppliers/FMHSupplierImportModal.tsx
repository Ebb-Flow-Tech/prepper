'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { importSuppliersFMH } from '@/lib/api';
import { ApiError } from '@/lib/api';

interface FMHSupplierImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FMHSupplierImportModal({ isOpen, onClose }: FMHSupplierImportModalProps) {
  const queryClient = useQueryClient();
  const suppliersRef = useRef<HTMLInputElement>(null);
  const pricingsRef = useRef<HTMLInputElement>(null);

  const [suppliersFile, setSuppliersFile] = useState<File | null>(null);
  const [pricingsFile, setPricingsFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  function reset() {
    setSuppliersFile(null);
    setPricingsFile(null);
    setIsImporting(false);
    if (suppliersRef.current) suppliersRef.current.value = '';
    if (pricingsRef.current) pricingsRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleImport() {
    if (!suppliersFile || !pricingsFile) return;
    setIsImporting(true);
    try {
      const res = await importSuppliersFMH(suppliersFile, pricingsFile);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      const parts = [
        `${res.suppliers_created} supplier${res.suppliers_created !== 1 ? 's' : ''} created`,
        `${res.suppliers_updated} code${res.suppliers_updated !== 1 ? 's' : ''} updated`,
      ];
      toast.success('Import complete', {
        description: parts.join(' · ') + (res.warnings.length > 0 ? ` · ${res.warnings.length} warning${res.warnings.length !== 1 ? 's' : ''}` : ''),
      });
      handleClose();
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Import failed. Please try again.';
      toast.error('Import failed', { description: message });
      handleClose();
    }
  }

  const canImport = !!suppliersFile && !!pricingsFile && !isImporting;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import FMH suppliers" disableClose={isImporting}>
      <div className="space-y-5">
        {/* Suppliers file */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Suppliers file <span className="text-[var(--color-feedback-error)]">*</span>
          </p>
          <input
            ref={suppliersRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => setSuppliersFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => suppliersRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm text-muted-foreground hover:bg-secondary transition-colors w-full"
          >
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {suppliersFile ? suppliersFile.name : 'Select Suppliers.xlsx'}
            </span>
          </button>
        </div>

        {/* Pricings file */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Supplier pricings file <span className="text-[var(--color-feedback-error)]">*</span>
          </p>
          <input
            ref={pricingsRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => setPricingsFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => pricingsRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-input text-sm text-muted-foreground hover:bg-secondary transition-colors w-full"
          >
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {pricingsFile ? pricingsFile.name : 'Select SponsoredSupplierPricings.xlsx'}
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button type="button" disabled={!canImport} onClick={handleImport}>
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
