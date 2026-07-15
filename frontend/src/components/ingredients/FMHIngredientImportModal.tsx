'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { importIngredientsFMH } from '@/lib/api';
import { ApiError } from '@/lib/api';

interface FMHIngredientImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FMHIngredientImportModal({ isOpen, onClose }: FMHIngredientImportModalProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [productsFile, setProductsFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  function reset() {
    setProductsFile(null);
    setIsImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleImport() {
    if (!productsFile) return;
    setIsImporting(true);
    try {
      const res = await importIngredientsFMH(productsFile);
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      const parts = [
        `${res.ingredients_created} ingredient${res.ingredients_created !== 1 ? 's' : ''} created`,
        ...(res.ingredients_updated > 0 ? [`${res.ingredients_updated} ingredient${res.ingredients_updated !== 1 ? 's' : ''} updated`] : []),
        `${res.categories_created} categor${res.categories_created !== 1 ? 'ies' : 'y'} created`,
        `${res.supplier_ingredients_created} supplier link${res.supplier_ingredients_created !== 1 ? 's' : ''} created`,
        ...(res.supplier_ingredients_updated > 0 ? [`${res.supplier_ingredients_updated} pricing record${res.supplier_ingredients_updated !== 1 ? 's' : ''} updated`] : []),
      ];
      toast.success('Import complete', {
        description: parts.join(' · '),
      });
      handleClose();
    } catch (e) {
      let message = e instanceof ApiError ? e.message : 'Import failed. Please try again.';
      if (e instanceof ApiError && e.status === 400) {
        message = 'Suppliers must be imported first. Go to the Suppliers page and run the FMH supplier import.';
      }
      toast.error('Import failed', { description: message });
      handleClose();
    }
  }

  const canImport = !!productsFile && !isImporting;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import FMH Ingredients" disableClose={isImporting}>
      <div className="space-y-5">
        {/* Products file */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Product List file <span className="text-red-500">*</span>
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => setProductsFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-input text-sm text-muted-foreground hover:bg-secondary transition-colors w-full"
          >
            <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {productsFile ? productsFile.name : 'Select ProductList.xlsx'}
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
